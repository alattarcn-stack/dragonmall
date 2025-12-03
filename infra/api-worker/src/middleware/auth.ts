import type { Context, Next } from 'hono'
import type { Env } from '../types'
import { verifyJWT, getJWTSecret, type JWTPayload } from '../utils/jwt'

// Auth middleware for public routes (no auth required)
export const publicAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  // Public mode - allow all requests
  await next()
}

// Auth middleware for admin routes (JWT + HTTP-only cookies)
export const adminAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const token = c.req.cookie('admin_token')

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Verify JWT token
    const jwtSecret = getJWTSecret(c.env)
    const payload = await verifyJWT(token, jwtSecret)

    if (!payload || payload.role !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Store user info in context
    c.set('adminId', payload.sub)
    c.set('role', payload.role)
    c.set('userId', payload.sub) // For backward compatibility
    c.set('isAdmin', true)

    await next()
  } catch (error) {
    console.error('Admin auth error:', error)
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

// Auth middleware for customer routes (authenticated customers)
export const customerAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const token = c.req.cookie('customer_token')

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Verify JWT token
    const jwtSecret = getJWTSecret(c.env)
    const payload = await verifyJWT(token, jwtSecret)

    if (!payload || payload.role !== 'customer') {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Store user info in context
    c.set('userId', payload.sub)
    c.set('customerId', payload.sub)
    c.set('role', payload.role)
    c.set('isAdmin', false)

    await next()
  } catch (error) {
    console.error('Customer auth error:', error)
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

// Auth middleware for user routes (authenticated users - backward compatibility)
export const userAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  // Alias to customerAuth for backward compatibility
  return customerAuth(c, next)
}

// Optional auth - allows both authenticated and guest access
export const optionalAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  try {
    const token = c.req.cookie('user_token') || 
                  c.req.cookie('admin_token') ||
                  c.req.header('Authorization')?.replace('Bearer ', '')

    if (token) {
      const jwtSecret = getJWTSecret(c.env)
      const payload = await verifyJWT(token, jwtSecret)

      if (payload) {
        c.set('userId', payload.sub)
        c.set('role', payload.role)
        c.set('isAdmin', payload.role === 'admin')
      } else {
        c.set('userId', null)
        c.set('isAdmin', false)
      }
    } else {
      c.set('userId', null)
      c.set('isAdmin', false)
    }
  } catch (error) {
    // On error, treat as guest
    c.set('userId', null)
    c.set('isAdmin', false)
  }

  await next()
}
