import type { Context, Next } from 'hono'
import type { Env } from '../types'
import { isSentryEnabled } from '../utils/sentry'

/**
 * Request ID Middleware
 * Generates a unique request ID for each request and attaches it to the context
 * This ID is included in logs and Sentry context for tracing
 */

// Simple UUID v4 generator (for Cloudflare Workers compatibility)
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`
}

export async function requestIdMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const requestId = generateRequestId()
  
  // Attach to context for use in routes
  c.set('requestId', requestId)
  
  // Add to response headers for client tracing
  c.res.headers.set('X-Request-ID', requestId)
  
  // Add to Sentry context if available
  if (isSentryEnabled(c.env)) {
    import('@sentry/cloudflare-workers').then((Sentry) => {
      Sentry.setTag('request_id', requestId)
      Sentry.setContext('request', {
        id: requestId,
        method: c.req.method,
        path: c.req.path,
        url: c.req.url,
      })
    }).catch(() => {
      // Sentry not available, ignore
    })
  }
  
  await next()
}

