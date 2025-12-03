import { Hono } from 'hono'
import type { Env } from '../types'
import { UserService } from '@dragon/core'
import { hashPassword, verifyPassword } from '../utils/password'
import { signJWT, getJWTSecret, verifyJWT } from '../utils/jwt'
import { checkRateLimit } from '../utils/rate-limit'
import { AuthSignupSchema, AuthLoginSchema, formatValidationError } from '../validation/schemas'
import { verifyCartToken, associateCartWithUser } from '../utils/cart'
import { logInfo } from '../utils/logging'

export function createCustomerAuthRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const userService = new UserService(env.D1_DATABASE)

  // POST /api/auth/signup
  router.post('/signup', async (c) => {
    try {
      const body = await c.req.json()
      const { email, password } = body

      if (!email || !password) {
        return c.json({ error: 'Email and password are required' }, 400)
      }


      // Rate limiting - check by IP
      const ipAddress = c.req.header('CF-Connecting-IP') || 
                       c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 
                       'unknown'
      
      const ipRateLimit = await checkRateLimit(env.KV_SESSIONS, 'signup', ipAddress, 'ip', 5, 600)
      if (!ipRateLimit.allowed) {
        return c.json({ 
          error: 'Too many signup attempts. Please try again later.' 
        }, 429)
      }

      // Check if email already exists
      const existing = await userService.getByEmail(email)
      if (existing) {
        return c.json({ error: 'Email already registered' }, 400)
      }

      // Hash password
      const passwordHash = await hashPassword(password)

      // Create customer user
      const user = await userService.create({
        email,
        passwordHash,
        role: 'customer',
        isActive: 1,
      })

      // Ensure role is set correctly (in case UserService doesn't handle it)
      await env.D1_DATABASE
        .prepare('UPDATE users SET role = ? WHERE id = ?')
        .bind('customer', user.id)
        .run()

      // Generate JWT token
      const jwtSecret = getJWTSecret(env)
      const token = await signJWT(
        { sub: user.id, role: 'customer' },
        jwtSecret,
        30 * 24 * 60 * 60 // 30 days
      )

      // Associate guest cart with user if cart token exists
      const cartToken = c.req.cookie('cart_token')
      if (cartToken) {
        try {
          const guestCartId = await verifyCartToken(cartToken, env)
          if (guestCartId) {
            await associateCartWithUser(guestCartId, user.id, user.email, env)
            logInfo('Guest cart associated with new user', { userId: user.id, cartId: guestCartId }, env)
          }
        } catch (error) {
          // If cart association fails, continue with signup
          console.error('Failed to associate cart:', error)
        }
      }

      // Set HTTP-only cookie
      c.cookie('customer_token', token, {
        httpOnly: true,
        secure: env.ENVIRONMENT === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      })

      // Clear cart token cookie (cart is now associated with user)
      c.cookie('cart_token', '', {
        httpOnly: true,
        secure: env.ENVIRONMENT === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })

      return c.json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: 'customer',
          },
        },
      }, 201)
    } catch (error: any) {
      console.error('Signup error:', error)
      return c.json({ error: 'Signup failed' }, 500)
    }
  })

  // POST /api/auth/login
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
      
      const ipRateLimit = await checkRateLimit(env.KV_SESSIONS, 'login', ipAddress, 'ip', 5, 600)
      if (!ipRateLimit.allowed) {
        return c.json({ 
          error: 'Too many login attempts. Please try again later.' 
        }, 429)
      }

      const emailRateLimit = await checkRateLimit(env.KV_SESSIONS, 'login', email, 'email', 5, 600)
      if (!emailRateLimit.allowed) {
        return c.json({ 
          error: 'Too many login attempts. Please try again later.' 
        }, 429)
      }

      // Get user by email
      const user = await userService.getByEmail(email)

      if (!user) {
        // Still consume a rate limit attempt even if user doesn't exist
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Check if user is active
      if (user.isActive !== 1) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Check if user is customer (not admin)
      const userResult = await env.D1_DATABASE
        .prepare('SELECT role FROM users WHERE id = ?')
        .bind(user.id)
        .first<{ role: string }>()

      const role = userResult?.role || 'customer'
      
      if (role !== 'customer') {
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
        { sub: user.id, role: 'customer' },
        jwtSecret,
        30 * 24 * 60 * 60 // 30 days
      )

      // Update last login
      await userService.updateLastLogin(user.id)

      // Associate guest cart with user if cart token exists
      const cartToken = c.req.cookie('cart_token')
      if (cartToken) {
        try {
          const { verifyCartToken, associateCartWithUser } = await import('../utils/cart')
          const guestCartId = await verifyCartToken(cartToken, env)
          if (guestCartId) {
            await associateCartWithUser(guestCartId, user.id, user.email, env)
            logInfo('Guest cart associated with logged-in user', { userId: user.id, cartId: guestCartId }, env)
          }
        } catch (error) {
          // If cart association fails, continue with login
          console.error('Failed to associate cart:', error)
        }
      }

      // Set HTTP-only cookie
      c.cookie('customer_token', token, {
        httpOnly: true,
        secure: env.ENVIRONMENT === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      })

      // Clear cart token cookie (cart is now associated with user)
      c.cookie('cart_token', '', {
        httpOnly: true,
        secure: env.ENVIRONMENT === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })

      return c.json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: 'customer',
          },
        },
      })
    } catch (error: any) {
      console.error('Login error:', error)
      return c.json({ error: 'Login failed' }, 500)
    }
  })

  // POST /api/auth/logout
  router.post('/logout', async (c) => {
    c.cookie('customer_token', '', {
      httpOnly: true,
      secure: env.ENVIRONMENT === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return c.json({ data: { message: 'Logged out' } })
  })

  // GET /api/auth/me
  router.get('/me', async (c) => {
    try {
      const token = c.req.cookie('customer_token')

      if (!token) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const jwtSecret = getJWTSecret(env)
      const payload = await verifyJWT(token, jwtSecret)

      if (!payload || payload.role !== 'customer') {
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
          role: userResult?.role || 'customer',
        },
      })
    } catch (error: any) {
      console.error('Auth me error:', error)
      return c.json({ error: 'Unauthorized' }, 401)
    }
  })

  return router
}

