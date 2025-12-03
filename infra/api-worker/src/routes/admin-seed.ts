import { Hono } from 'hono'
import type { Env } from '../types'
import { UserService } from '@dragon/core'
import { hashPassword } from '../utils/password'

/**
 * Development-only route to seed an initial admin user
 * This should be removed or heavily secured in production
 */
export function createAdminSeedRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const userService = new UserService(env.D1_DATABASE)

  // POST /api/admin/seed (DEV ONLY)
  router.post('/seed', async (c) => {
    // Only allow in development
    if (env.ENVIRONMENT === 'production') {
      return c.json({ error: 'Not available in production' }, 403)
    }

    try {
      const body = await c.req.json().catch(() => ({}))
      const email = body.email || 'admin@example.com'
      const password = body.password || 'Admin123!'

      // Check if admin already exists
      const existing = await userService.getByEmail(email)
      if (existing) {
        return c.json({ 
          error: 'Admin user already exists',
          message: 'Use the login endpoint instead'
        }, 400)
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
      return c.json({ 
        error: 'Failed to create admin user',
        message: env.ENVIRONMENT === 'development' ? error.message : undefined
      }, 500)
    }
  })

  return router
}

