import type { Env } from '../types'

/**
 * Environment variable validation errors
 */
export class EnvValidationError extends Error {
  constructor(message: string, public missingVars: string[] = []) {
    super(message)
    this.name = 'EnvValidationError'
  }
}

/**
 * Validation result for a single environment variable
 */
interface ValidationResult {
  valid: boolean
  message?: string
}

/**
 * Validate JWT_SECRET
 */
function validateJWTSecret(env: Env): ValidationResult {
  if (!env.JWT_SECRET) {
    return {
      valid: false,
      message: 'JWT_SECRET is required but not set. Please set JWT_SECRET in your environment variables (minimum 32 characters).',
    }
  }

  if (env.JWT_SECRET.length < 32) {
    return {
      valid: false,
      message: `JWT_SECRET must be at least 32 characters long, but got ${env.JWT_SECRET.length} characters. Please set a longer JWT_SECRET in your environment variables.`,
    }
  }

  return { valid: true }
}

/**
 * Validate Stripe configuration
 * If any Stripe variable is set, all required ones must be set
 */
function validateStripeConfig(env: Env): ValidationResult {
  const hasStripeKey = !!env.STRIPE_SECRET_KEY
  const hasWebhookSecret = !!env.STRIPE_WEBHOOK_SECRET
  const hasPublishableKey = !!env.STRIPE_PUBLISHABLE_KEY

  // If no Stripe config is set, it's optional
  if (!hasStripeKey && !hasWebhookSecret && !hasPublishableKey) {
    return { valid: true }
  }

  const missing: string[] = []
  const invalid: string[] = []

  // Check required Stripe variables
  if (!hasStripeKey) {
    missing.push('STRIPE_SECRET_KEY')
  } else if (!env.STRIPE_SECRET_KEY!.startsWith('sk_')) {
    invalid.push('STRIPE_SECRET_KEY (must start with "sk_")')
  }

  if (!hasWebhookSecret) {
    missing.push('STRIPE_WEBHOOK_SECRET')
  } else if (!env.STRIPE_WEBHOOK_SECRET!.startsWith('whsec_')) {
    invalid.push('STRIPE_WEBHOOK_SECRET (must start with "whsec_")')
  }

  if (!hasPublishableKey) {
    missing.push('STRIPE_PUBLISHABLE_KEY')
  } else if (!env.STRIPE_PUBLISHABLE_KEY!.startsWith('pk_')) {
    invalid.push('STRIPE_PUBLISHABLE_KEY (must start with "pk_")')
  }

  if (missing.length > 0 || invalid.length > 0) {
    const messages: string[] = []
    if (missing.length > 0) {
      messages.push(`Missing required Stripe variables: ${missing.join(', ')}`)
    }
    if (invalid.length > 0) {
      messages.push(`Invalid Stripe variables: ${invalid.join(', ')}`)
    }
    return {
      valid: false,
      message: `Stripe configuration is incomplete. ${messages.join(' ')} If you're not using Stripe, remove all Stripe-related environment variables.`,
    }
  }

  return { valid: true }
}

/**
 * Validate PayPal configuration
 * If any PayPal variable is set, all required ones must be set
 */
function validatePayPalConfig(env: Env): ValidationResult {
  const hasClientId = !!env.PAYPAL_CLIENT_ID
  const hasClientSecret = !!env.PAYPAL_CLIENT_SECRET
  const hasWebhookId = !!env.PAYPAL_WEBHOOK_ID

  // If no PayPal config is set, it's optional
  if (!hasClientId && !hasClientSecret && !hasWebhookId) {
    return { valid: true }
  }

  const missing: string[] = []

  // Check required PayPal variables
  if (!hasClientId) {
    missing.push('PAYPAL_CLIENT_ID')
  }

  if (!hasClientSecret) {
    missing.push('PAYPAL_CLIENT_SECRET')
  }

  // PAYPAL_WEBHOOK_ID is optional (only needed if using webhooks)
  // But if webhooks are used, it should be set

  if (missing.length > 0) {
    return {
      valid: false,
      message: `PayPal configuration is incomplete. Missing required variables: ${missing.join(', ')}. If you're not using PayPal, remove all PayPal-related environment variables.`,
    }
  }

  return { valid: true }
}

/**
 * Validate email configuration
 * If EMAIL_API_KEY is set, EMAIL_PROVIDER should be set
 */
function validateEmailConfig(env: Env): ValidationResult {
  const hasApiKey = !!env.EMAIL_API_KEY
  const hasProvider = !!env.EMAIL_PROVIDER

  // Email is optional, but if API key is set, provider should be set
  if (!hasApiKey) {
    return { valid: true }
  }

  if (!hasProvider) {
    return {
      valid: false,
      message: 'EMAIL_PROVIDER is required when EMAIL_API_KEY is set. Set EMAIL_PROVIDER to "resend" or "sendgrid".',
    }
  }

  const provider = env.EMAIL_PROVIDER.toLowerCase()
  if (provider !== 'resend' && provider !== 'sendgrid') {
    return {
      valid: false,
      message: `EMAIL_PROVIDER must be "resend" or "sendgrid", but got "${env.EMAIL_PROVIDER}".`,
    }
  }

  return { valid: true }
}

/**
 * Validate production URLs
 * In production, FRONTEND_URL and ADMIN_URL should be set
 */
function validateProductionUrls(env: Env): ValidationResult {
  const isProduction = env.ENVIRONMENT === 'production'

  if (!isProduction) {
    return { valid: true }
  }

  const missing: string[] = []

  if (!env.FRONTEND_URL) {
    missing.push('FRONTEND_URL')
  } else if (!env.FRONTEND_URL.startsWith('https://')) {
    return {
      valid: false,
      message: 'FRONTEND_URL must use HTTPS in production. Example: https://store.example.com',
    }
  }

  if (!env.ADMIN_URL) {
    missing.push('ADMIN_URL')
  } else if (!env.ADMIN_URL.startsWith('https://')) {
    return {
      valid: false,
      message: 'ADMIN_URL must use HTTPS in production. Example: https://admin.example.com',
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      message: `In production, the following URLs are required: ${missing.join(', ')}. These are used for CORS configuration.`,
    }
  }

  return { valid: true }
}

/**
 * Validate all required environment variables
 * 
 * This function checks:
 * - JWT_SECRET (always required, minimum 32 characters)
 * - Stripe configuration (if any Stripe var is set, all must be set)
 * - PayPal configuration (if any PayPal var is set, client ID and secret must be set)
 * - Email configuration (if EMAIL_API_KEY is set, EMAIL_PROVIDER must be set)
 * - Production URLs (if ENVIRONMENT=production, FRONTEND_URL and ADMIN_URL must be set with HTTPS)
 * 
 * @param env - Environment variables object
 * @throws {EnvValidationError} If validation fails
 */
export function validateEnv(env: Env): void {
  const errors: string[] = []
  const missingVars: string[] = []

  // Validate JWT_SECRET (always required)
  const jwtResult = validateJWTSecret(env)
  if (!jwtResult.valid) {
    errors.push(jwtResult.message!)
    missingVars.push('JWT_SECRET')
  }

  // Validate Stripe configuration
  const stripeResult = validateStripeConfig(env)
  if (!stripeResult.valid) {
    errors.push(stripeResult.message!)
    if (stripeResult.message!.includes('STRIPE_SECRET_KEY')) missingVars.push('STRIPE_SECRET_KEY')
    if (stripeResult.message!.includes('STRIPE_WEBHOOK_SECRET')) missingVars.push('STRIPE_WEBHOOK_SECRET')
    if (stripeResult.message!.includes('STRIPE_PUBLISHABLE_KEY')) missingVars.push('STRIPE_PUBLISHABLE_KEY')
  }

  // Validate PayPal configuration
  const paypalResult = validatePayPalConfig(env)
  if (!paypalResult.valid) {
    errors.push(paypalResult.message!)
    if (paypalResult.message!.includes('PAYPAL_CLIENT_ID')) missingVars.push('PAYPAL_CLIENT_ID')
    if (paypalResult.message!.includes('PAYPAL_CLIENT_SECRET')) missingVars.push('PAYPAL_CLIENT_SECRET')
  }

  // Validate email configuration
  const emailResult = validateEmailConfig(env)
  if (!emailResult.valid) {
    errors.push(emailResult.message!)
    if (emailResult.message!.includes('EMAIL_PROVIDER')) missingVars.push('EMAIL_PROVIDER')
  }

  // Validate production URLs
  const urlResult = validateProductionUrls(env)
  if (!urlResult.valid) {
    errors.push(urlResult.message!)
    if (urlResult.message!.includes('FRONTEND_URL')) missingVars.push('FRONTEND_URL')
    if (urlResult.message!.includes('ADMIN_URL')) missingVars.push('ADMIN_URL')
  }

  // If there are any errors, throw
  if (errors.length > 0) {
    const errorMessage = [
      'Environment validation failed:',
      ...errors.map((e, i) => `${i + 1}. ${e}`),
      '',
      'Please check your environment variables and ensure all required variables are set.',
      'See infra/ENVIRONMENT.md for complete documentation.',
    ].join('\n')

    throw new EnvValidationError(errorMessage, missingVars)
  }
}

