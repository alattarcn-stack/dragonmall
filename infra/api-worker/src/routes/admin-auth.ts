import { Hono } from 'hono'
import type { Env } from '../types'
import { UserService } from '@dragon/core'
import { verifyPassword } from '../utils/password'
import { signJWT, getJWTSecret, verifyJWT } from '../utils/jwt'
import { checkRateLimit } from '../utils/rate-limit'
import { AuthLoginSchema, formatValidationError } from '../validation/schemas'

export function createAdminAuthRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const userService = new UserService(env.D1_DATABASE)

  // POST /api/admin/auth/login
  router.post('/login', async (c) => {
    try {
      const body = await c.req.json()

      // Validate input
      const validationResult = AuthLoginSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { email, password } = validationResult.data

      // Rate limiting - check by IP and email
      const ipAddress = c.req.header('CF-Connecting-IP') || 
                       c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 
                       'unknown'
      
      const ipRateLimit = await checkRateLimit(env.KV_SESSIONS, 'admin-login', ipAddress, 'ip', 5, 600)
      if (!ipRateLimit.allowed) {
        return c.json({ 
          error: 'Too many login attempts. Please try again later.' 
        }, 429)
      }

      const emailRateLimit = await checkRateLimit(env.KV_SESSIONS, 'admin-login', email, 'email', 5, 600)
      if (!emailRateLimit.allowed) {
        return c.json({ 
          error: 'Too many login attempts. Please try again later.' 
        }, 429)
      }

      // Get user by email
      const user = await userService.getByEmail(email)

      if (!user) {
        // Still consume a rate limit attempt even if user doesn't exist
        // This prevents user enumeration attacks
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Check if user is active
      if (user.isActive !== 1) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Check if user is admin - query role from database
      const userResult = await env.D1_DATABASE
        .prepare('SELECT role FROM users WHERE id = ?')
        .bind(user.id)
        .first<{ role: string }>()

      // If role column doesn't exist yet (migration pending), default to admin for existing users
      const role = userResult?.role || 'admin'
      
      if (role !== 'admin') {
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Verify password
      const isValid = await verifyPassword(password, user.passwordHash)
      
      if (!isValid) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Generate JWT token
      const jwtSecret = getJWTSecret(env)
      const token = await signJWT(
        { sub: user.id, role: 'admin' },
        jwtSecret,
        24 * 60 * 60 // 24 hours
      )

      // Update last login
      await userService.updateLastLogin(user.id)

      // Set HTTP-only cookie
      c.cookie('admin_token', token, {
        httpOnly: true,
        secure: env.ENVIRONMENT === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/',
      })

      return c.json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: 'admin',
          },
        },
      })
    } catch (error: any) {
      console.error('Login error:', error)
      return c.json({ error: 'Login failed' }, 500)
    }
  })

  // POST /api/admin/auth/logout
  router.post('/logout', async (c) => {
    c.cookie('admin_token', '', {
      httpOnly: true,
      secure: env.ENVIRONMENT === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return c.json({ data: { message: 'Logged out' } })
  })

  // GET /api/admin/auth/me
  router.get('/me', async (c) => {
    try {
      const token = c.req.cookie('admin_token')

      if (!token) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const jwtSecret = getJWTSecret(env)
      const payload = await verifyJWT(token, jwtSecret)

      if (!payload || payload.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const user = await userService.getById(payload.sub)
      if (!user) {
        return c.json({ error: 'User not found' }, 404)
      }

      // Get role from database
      const userResult = await env.D1_DATABASE
        .prepare('SELECT role FROM users WHERE id = ?')
        .bind(user.id)
        .first<{ role: string }>()

      return c.json({
        data: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: userResult?.role || 'admin',
        },
      })
    } catch (error: any) {
      console.error('Auth me error:', error)
      return c.json({ error: 'Unauthorized' }, 401)
    }
  })

  return router
}
