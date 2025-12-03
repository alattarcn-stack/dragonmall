import type { Env } from '../types'

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error'
  version: string
  env: string
  timestamp: string
  checks: {
    database?: {
      status: 'ok' | 'error'
      message?: string
    }
    stripe?: {
      status: 'ok' | 'error' | 'not_configured'
      message?: string
    }
    paypal?: {
      status: 'ok' | 'error' | 'not_configured'
      message?: string
    }
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(env: Env): Promise<{ status: 'ok' | 'error'; message?: string }> {
  try {
    // Simple query to check database connectivity
    const result = await env.D1_DATABASE.prepare('SELECT 1 as test').first<{ test: number }>()
    
    if (result && result.test === 1) {
      return { status: 'ok' }
    }
    
    return { status: 'error', message: 'Database query returned unexpected result' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database connection failed',
    }
  }
}

/**
 * Check Stripe readiness (non-blocking)
 * Only checks if configuration is present, doesn't make API calls
 */
function checkStripe(env: Env): { status: 'ok' | 'error' | 'not_configured'; message?: string } {
  const hasSecretKey = !!env.STRIPE_SECRET_KEY
  const hasWebhookSecret = !!env.STRIPE_WEBHOOK_SECRET
  const hasPublishableKey = !!env.STRIPE_PUBLISHABLE_KEY

  // If no Stripe config, it's not configured
  if (!hasSecretKey && !hasWebhookSecret && !hasPublishableKey) {
    return { status: 'not_configured' }
  }

  // Check if all required keys are present
  if (!hasSecretKey) {
    return { status: 'error', message: 'STRIPE_SECRET_KEY is missing' }
  }

  if (!hasWebhookSecret) {
    return { status: 'error', message: 'STRIPE_WEBHOOK_SECRET is missing' }
  }

  if (!hasPublishableKey) {
    return { status: 'error', message: 'STRIPE_PUBLISHABLE_KEY is missing' }
  }

  // Check format (basic validation)
  if (!env.STRIPE_SECRET_KEY!.startsWith('sk_')) {
    return { status: 'error', message: 'STRIPE_SECRET_KEY has invalid format' }
  }

  if (!env.STRIPE_WEBHOOK_SECRET!.startsWith('whsec_')) {
    return { status: 'error', message: 'STRIPE_WEBHOOK_SECRET has invalid format' }
  }

  if (!env.STRIPE_PUBLISHABLE_KEY!.startsWith('pk_')) {
    return { status: 'error', message: 'STRIPE_PUBLISHABLE_KEY has invalid format' }
  }

  return { status: 'ok' }
}

/**
 * Check PayPal readiness (non-blocking)
 * Only checks if configuration is present, doesn't make API calls
 */
function checkPayPal(env: Env): { status: 'ok' | 'error' | 'not_configured'; message?: string } {
  const hasClientId = !!env.PAYPAL_CLIENT_ID
  const hasClientSecret = !!env.PAYPAL_CLIENT_SECRET

  // If no PayPal config, it's not configured
  if (!hasClientId && !hasClientSecret) {
    return { status: 'not_configured' }
  }

  // Check if required keys are present
  if (!hasClientId) {
    return { status: 'error', message: 'PAYPAL_CLIENT_ID is missing' }
  }

  if (!hasClientSecret) {
    return { status: 'error', message: 'PAYPAL_CLIENT_SECRET is missing' }
  }

  return { status: 'ok' }
}

/**
 * Get application version
 * Reads from package.json or uses default
 */
function getVersion(): string {
  // In Cloudflare Workers, we can't easily read package.json at runtime
  // Use environment variable if set, otherwise use a default
  // This can be set during build/deployment
  return '0.1.0' // Default version, can be overridden via env var
}

/**
 * Perform comprehensive health check
 * 
 * @param env - Environment variables
 * @returns Health check result
 */
export async function performHealthCheck(env: Env): Promise<HealthCheckResult> {
  const version = env.VERSION || getVersion()
  const environment = env.ENVIRONMENT || 'development'
  const timestamp = new Date().toISOString()

  // Perform checks (database is async, others are sync)
  const [databaseCheck] = await Promise.allSettled([
    checkDatabase(env),
  ])

  const stripeCheck = checkStripe(env)
  const paypalCheck = checkPayPal(env)

  // Determine overall status
  const checks = {
    database: databaseCheck.status === 'fulfilled' ? databaseCheck.value : { status: 'error' as const, message: 'Database check failed' },
    stripe: stripeCheck,
    paypal: paypalCheck,
  }

  // Overall status logic:
  // - 'error' if database is down (critical)
  // - 'degraded' if payment providers are misconfigured but database is ok
  // - 'ok' if everything is fine
  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok'

  if (checks.database?.status === 'error') {
    overallStatus = 'error'
  } else if (
    (checks.stripe?.status === 'error') ||
    (checks.paypal?.status === 'error')
  ) {
    overallStatus = 'degraded'
  }

  return {
    status: overallStatus,
    version,
    env: environment,
    timestamp,
    checks,
  }
}

