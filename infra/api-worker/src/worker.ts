/**
 * Cloudflare Workers Entry Point
 * This file wraps the Hono app with Sentry error tracking
 */

import app from './index'
import { initSentry, isSentryEnabled } from './utils/sentry'
import type { Env } from './types'
import { validateEnv, EnvValidationError } from './utils/env-validation'
import * as Sentry from '@sentry/cloudflare-workers'

// Initialize Sentry on module load (for production)
// Note: env is not available at module load, so we initialize per request

// Export the fetch handler wrapped with Sentry
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Validate all required environment variables at startup (fail fast)
    // This runs on every request, but it's a fast check and ensures we fail immediately
    // if the environment is misconfigured
    try {
      validateEnv(env)
    } catch (error) {
      // Log the error and return a 500 response
      console.error('Environment validation failed:', error)
      
      const isProd = env.ENVIRONMENT === 'production'
      
      // In production, only send generic error messages
      const responseBody: {
        error: string
        message?: string
        missingVars?: string[]
      } = {
        error: 'CONFIGURATION_ERROR',
      }
      
      if (!isProd) {
        if (error instanceof EnvValidationError) {
          responseBody.message = error.message
          responseBody.missingVars = error.missingVars
        } else if (error instanceof Error) {
          responseBody.message = error.message
        }
      }
      
      return new Response(
        JSON.stringify(responseBody),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

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

