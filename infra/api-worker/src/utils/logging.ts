import type { Env } from '../types'
import { isSentryEnabled } from './sentry'

/**
 * Logging utilities that work in both development and production
 * In production, logs are sent to Sentry as breadcrumbs
 */

interface LogMeta {
  [key: string]: any
}

// Sentry will be imported dynamically when needed

/**
 * Log an info message
 * In dev: console.log
 * In production: console.log + Sentry breadcrumb
 */
export function logInfo(message: string, meta?: LogMeta, env?: Env): void {
  const logData = meta ? { message, ...meta } : { message }
  
  // Always log to console
  console.log('[INFO]', logData)
  
  // In production, send to Sentry as breadcrumb
  if (env && isSentryEnabled(env)) {
    import('@sentry/cloudflare').then((Sentry) => {
      Sentry.addBreadcrumb({
        message,
        level: 'info',
        data: meta,
        timestamp: Date.now() / 1000,
      })
    }).catch(() => {
      // Sentry not available, ignore
    })
  }
}

/**
 * Log an error message
 * In dev: console.error
 * In production: console.error + Sentry error
 */
export function logError(message: string, error?: Error | unknown, meta?: LogMeta, env?: Env): void {
  const logData = meta ? { message, ...meta } : { message }
  
  // Always log to console
  if (error instanceof Error) {
    console.error('[ERROR]', logData, error)
  } else {
    console.error('[ERROR]', logData, error)
  }
  
  // In production, send to Sentry
  if (env && isSentryEnabled(env)) {
    import('@sentry/cloudflare').then((Sentry) => {
      if (error instanceof Error) {
        Sentry.captureException(error, {
          extra: meta,
          tags: {
            error_type: 'application_error',
          },
        })
      } else {
        Sentry.captureMessage(message, {
          level: 'error',
          extra: { ...meta, error },
          tags: {
            error_type: 'application_error',
          },
        })
      }
    }).catch(() => {
      // Sentry not available, ignore
    })
  }
}

/**
 * Log a warning message
 */
export function logWarn(message: string, meta?: LogMeta, env?: Env): void {
  const logData = meta ? { message, ...meta } : { message }
  
  console.warn('[WARN]', logData)
  
  if (env && isSentryEnabled(env)) {
    import('@sentry/cloudflare').then((Sentry) => {
      Sentry.addBreadcrumb({
        message,
        level: 'warning',
        data: meta,
        timestamp: Date.now() / 1000,
      })
    }).catch(() => {
      // Sentry not available, ignore
    })
  }
}

