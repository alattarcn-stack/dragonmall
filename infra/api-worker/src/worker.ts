/**
 * Cloudflare Workers Entry Point
 * This file wraps the Hono app with Sentry error tracking
 */

import app from './index'
import { initSentry, isSentryEnabled } from './utils/sentry'
import type { Env } from './types'
import * as Sentry from '@sentry/cloudflare-workers'

/**
 * Validate critical environment variables at startup
 * Throws an error if validation fails, causing the worker to fail fast
 */
function validateEnvironment(env: Env): void {
  // Validate JWT_SECRET - critical for authentication
  if (!env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is required but not set. ' +
      'Please set JWT_SECRET in your environment variables (minimum 32 characters).'
    )
  }

  if (env.JWT_SECRET.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters long, but got ${env.JWT_SECRET.length} characters. ` +
      'Please set a longer JWT_SECRET in your environment variables.'
    )
  }
}

// Initialize Sentry on module load (for production)
// Note: env is not available at module load, so we initialize per request

// Export the fetch handler wrapped with Sentry
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Validate critical environment variables at startup (fail fast)
    // This runs on every request, but it's a fast check and ensures we fail immediately
    // if the environment is misconfigured
    try {
      validateEnvironment(env)
    } catch (error) {
      // Log the error and return a 500 response
      console.error('Environment validation failed:', error)
      
      const isProd = env.ENVIRONMENT === 'production'
      
      // In production, only send generic error messages
      const responseBody: {
        error: string
        message?: string
      } = {
        error: 'CONFIGURATION_ERROR',
      }
      
      if (!isProd && error instanceof Error) {
        responseBody.message = error.message
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

