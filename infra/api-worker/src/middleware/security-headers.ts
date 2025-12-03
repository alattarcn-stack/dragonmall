import type { Context, Next } from 'hono'
import type { Env } from '../types'

/**
 * Security headers middleware
 * Adds security headers to all API responses
 */
export const securityHeaders = async (c: Context<{ Bindings: Env }>, next: Next) => {
  await next()

  // X-Content-Type-Options: Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff')

  // X-Frame-Options: Prevent clickjacking
  c.header('X-Frame-Options', 'DENY')

  // X-XSS-Protection: Disable XSS filter (modern browsers handle this better)
  c.header('X-XSS-Protection', '0')

  // Referrer-Policy: Don't send referrer information
  c.header('Referrer-Policy', 'no-referrer')

  // Content-Security-Policy: Relaxed but safe default for APIs
  // APIs typically don't need strict CSP, but we set a basic one
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'none'; object-src 'none';"
  )

  // Strict-Transport-Security: Force HTTPS (only in production)
  if (c.env.ENVIRONMENT === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

