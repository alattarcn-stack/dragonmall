import type { Context, Next } from 'hono'
import type { Env } from '../types'

/**
 * CSRF protection middleware
 * For state-changing routes, requires X-Requested-With header
 * This is a simple mitigation - full CSRF protection would require tokens
 */
export const csrfProtection = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const method = c.req.method

  // Only check state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const requestedWith = c.req.header('X-Requested-With')

    // Require X-Requested-With header for state-changing requests
    // This prevents simple CSRF attacks from external sites
    if (requestedWith !== 'XMLHttpRequest') {
      return c.json(
        {
          error: 'CSRF_PROTECTION',
          message: 'Missing required header. This request may be blocked for security reasons.',
        },
        403
      )
    }
  }

  await next()
}

/**
 * Optional CSRF protection - only for sensitive routes
 * Use this for routes that need extra protection
 */
export const strictCsrfProtection = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const method = c.req.method

  // Check all methods, including GET for sensitive operations
  const requestedWith = c.req.header('X-Requested-With')

  if (requestedWith !== 'XMLHttpRequest') {
    return c.json(
      {
        error: 'CSRF_PROTECTION',
        message: 'Missing required header. This request may be blocked for security reasons.',
      },
      403
    )
  }

  await next()
}

