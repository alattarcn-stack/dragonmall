import { Hono } from 'hono'
import type { Env } from '../types'
import { UserService } from '@dragon/core'
import { hashPassword } from '../utils/password'
import { makeError, ErrorCodes } from '../utils/errors'

/**
 * Development-only route to seed an initial admin user
 * 
 * SECURITY: This route should NEVER be available in production.
 * It requires:
 * - ENVIRONMENT !== 'production'
 * - SEED_SECRET header or query parameter
 * - Optional: IP restriction to localhost (127.0.0.1)
 */
export function createAdminSeedRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const userService = new UserService(env.D1_DATABASE)

  // POST /api/admin/seed (DEV ONLY - requires SEED_SECRET)
  // Note: Route is only mounted when ENVIRONMENT !== 'production' in index.ts
  // This is a defense-in-depth check in case the route is accidentally mounted
  router.post('/seed', async (c) => {
    // Defense in depth: Double-check production (should never reach here in production)
    if (env.ENVIRONMENT === 'production') {
      return c.json(makeError(ErrorCodes.FORBIDDEN, 'Not available in production'), 403)
    }

    // Defense in depth: Double-check SEED_SECRET is configured
    if (!env.SEED_SECRET) {
      return c.json({ 
        error: 'Seed endpoint not configured',
        message: 'SEED_SECRET must be set in environment variables'
      }, 500)
    }

    // Get secret from header (preferred) or query parameter (fallback)
    // Header name is case-insensitive, but we check both common variations
    const providedSecret = c.req.header('x-seed-secret') || 
                           c.req.header('X-Seed-Secret') ||
                           c.req.query('seed_secret') ||
                           c.req.query('secret')

    // Verify secret matches environment variable
    if (!providedSecret || providedSecret !== env.SEED_SECRET) {
      return c.json({ 
        error: 'Forbidden',
        message: 'Invalid or missing seed secret. Provide x-seed-secret header matching SEED_SECRET environment variable.'
      }, 403)
    }

    // Optional: Restrict to localhost IP (additional security layer for non-development)
    const clientIP = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
                     'unknown'
    
    // In staging/test environments (not development), restrict to localhost
    // In development, allow any IP (for Docker, remote dev, etc.)
    if (env.ENVIRONMENT && 
        env.ENVIRONMENT !== 'development' && 
        env.ENVIRONMENT !== 'production') {
      // Staging/test: require localhost
      if (clientIP !== '127.0.0.1' && 
          clientIP !== '::1' && 
          !clientIP.startsWith('127.') &&
          clientIP !== 'unknown') {
        return c.json({ 
          error: 'Forbidden',
          message: 'Seed endpoint only accessible from localhost in non-development environments'
        }, 403)
      }
    }

    try {
      const body = await c.req.json().catch(() => ({}))
      const email = body.email || 'admin@example.com'
      const password = body.password || 'Admin123!'

      // Check if admin already exists
      const existing = await userService.getByEmail(email)
      if (existing) {
        return c.json(makeError(ErrorCodes.CONFLICT, 'Admin user already exists', { message: 'Use the login endpoint instead' }), 400)
      }

      // Hash password
      const passwordHash = await hashPassword(password)

      // Create admin user
      const admin = await userService.create({
        email,
        username: 'Admin',
        passwordHash,
        role: 'admin',
        isActive: 1,
      })

      // Update role in database (since UserService.create might not handle it)
      await env.D1_DATABASE
        .prepare('UPDATE users SET role = ? WHERE id = ?')
        .bind('admin', admin.id)
        .run()

      return c.json({
        data: {
          message: 'Admin user created successfully',
          user: {
            id: admin.id,
            email: admin.email,
            role: 'admin',
          },
          note: 'Please change the default password after first login',
        },
      })
    } catch (error: any) {
      console.error('Seed error:', error)
      return c.json(makeError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create admin user',
        env.ENVIRONMENT === 'development' ? { originalError: error.message } : undefined
      ), 500)
    }
  })

  return router
}

