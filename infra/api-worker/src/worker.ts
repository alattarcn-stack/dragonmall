/**
 * Cloudflare Workers Entry Point
 * This file wraps the Hono app with Sentry error tracking
 */

import app from './index'
import { initSentry, isSentryEnabled } from './utils/sentry'
import type { Env } from './types'
import * as Sentry from '@sentry/cloudflare-workers'

// Initialize Sentry on module load (for production)
// Note: env is not available at module load, so we initialize per request

// Export the fetch handler wrapped with Sentry
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry if in production with DSN
    initSentry(env)

    // If Sentry is enabled, wrap with Sentry
    if (isSentryEnabled(env)) {
      return Sentry.wrapWithSentry(app.fetch.bind(app))(request, env, ctx)
    }

    // In development or without DSN, just call app
    return app.fetch(request, env, ctx)
  },
}

