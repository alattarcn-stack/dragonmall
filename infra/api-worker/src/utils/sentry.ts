import * as Sentry from '@sentry/cloudflare'
import type { Env } from '../types'

// Global Sentry instance (initialized once)
let sentryInitialized = false

/**
 * Initialize Sentry for Cloudflare Workers
 * Only enabled in production when SENTRY_DSN is set
 */
export function initSentry(env: Env): void {
  // Only initialize once and in production with DSN
  if (!sentryInitialized && env.ENVIRONMENT === 'production' && env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT || 'production',
      tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
      beforeSend(event) {
        // Add environment context
        event.environment = env.ENVIRONMENT || 'production'
        return event
      },
    })
    sentryInitialized = true
  }
}

/**
 * Check if Sentry is available
 */
export function isSentryEnabled(env: Env): boolean {
  return env.ENVIRONMENT === 'production' && !!env.SENTRY_DSN && sentryInitialized
}

