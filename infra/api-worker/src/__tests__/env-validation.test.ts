import { describe, it, expect } from 'vitest'
import { validateEnv, EnvValidationError } from '../utils/env-validation'
import type { Env } from '../types'

describe('Environment Variable Validation', () => {
  const baseEnv: Env = {
    D1_DATABASE: {} as any,
    R2_BUCKET: {} as any,
    KV_SESSIONS: {} as any,
    QUEUE_WEBHOOKS: {} as any,
  }

  describe('JWT_SECRET validation', () => {
    it('should throw if JWT_SECRET is missing', () => {
      const env = { ...baseEnv }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        expect(error).toBeInstanceOf(EnvValidationError)
        expect((error as EnvValidationError).message).toContain('JWT_SECRET')
        expect((error as EnvValidationError).missingVars).toContain('JWT_SECRET')
      }
    })

    it('should throw if JWT_SECRET is too short', () => {
      const env = { ...baseEnv, JWT_SECRET: 'short' }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        expect((error as EnvValidationError).message).toContain('32 characters')
      }
    })

    it('should pass if JWT_SECRET is valid', () => {
      const env = { ...baseEnv, JWT_SECRET: 'a'.repeat(32) }
      
      expect(() => validateEnv(env)).not.toThrow()
    })
  })

  describe('Stripe configuration validation', () => {
    it('should pass if no Stripe variables are set', () => {
      const env = { ...baseEnv, JWT_SECRET: 'a'.repeat(32) }
      
      expect(() => validateEnv(env)).not.toThrow()
    })

    it('should throw if STRIPE_SECRET_KEY is set but others are missing', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        STRIPE_SECRET_KEY: 'sk_test_123',
      }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        expect((error as EnvValidationError).message).toContain('Stripe')
        expect((error as EnvValidationError).message).toContain('STRIPE_WEBHOOK_SECRET')
        expect((error as EnvValidationError).message).toContain('STRIPE_PUBLISHABLE_KEY')
      }
    })

    it('should throw if STRIPE_SECRET_KEY has invalid format', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        STRIPE_SECRET_KEY: 'invalid_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        expect((error as EnvValidationError).message).toContain('STRIPE_SECRET_KEY')
        expect((error as EnvValidationError).message).toContain('sk_')
      }
    })

    it('should pass if all Stripe variables are valid', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      }
      
      expect(() => validateEnv(env)).not.toThrow()
    })
  })

  describe('PayPal configuration validation', () => {
    it('should pass if no PayPal variables are set', () => {
      const env = { ...baseEnv, JWT_SECRET: 'a'.repeat(32) }
      
      expect(() => validateEnv(env)).not.toThrow()
    })

    it('should throw if PAYPAL_CLIENT_ID is set but PAYPAL_CLIENT_SECRET is missing', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        PAYPAL_CLIENT_ID: 'test_client_id',
      }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        expect((error as EnvValidationError).message).toContain('PayPal')
        expect((error as EnvValidationError).message).toContain('PAYPAL_CLIENT_SECRET')
      }
    })

    it('should pass if PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        PAYPAL_CLIENT_ID: 'test_client_id',
        PAYPAL_CLIENT_SECRET: 'test_client_secret',
      }
      
      expect(() => validateEnv(env)).not.toThrow()
    })
  })

  describe('Email configuration validation', () => {
    it('should pass if EMAIL_API_KEY is not set', () => {
      const env = { ...baseEnv, JWT_SECRET: 'a'.repeat(32) }
      
      expect(() => validateEnv(env)).not.toThrow()
    })

    it('should throw if EMAIL_API_KEY is set but EMAIL_PROVIDER is missing', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        EMAIL_API_KEY: 'test_api_key',
      }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        expect((error as EnvValidationError).message).toContain('EMAIL_PROVIDER')
      }
    })

    it('should throw if EMAIL_PROVIDER is invalid', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        EMAIL_API_KEY: 'test_api_key',
        EMAIL_PROVIDER: 'invalid',
      }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        expect((error as EnvValidationError).message).toContain('resend')
        expect((error as EnvValidationError).message).toContain('sendgrid')
      }
    })

    it('should pass if EMAIL_API_KEY and valid EMAIL_PROVIDER are set', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        EMAIL_API_KEY: 'test_api_key',
        EMAIL_PROVIDER: 'resend',
      }
      
      expect(() => validateEnv(env)).not.toThrow()
    })
  })

  describe('Production URL validation', () => {
    it('should pass if ENVIRONMENT is not production', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        ENVIRONMENT: 'development',
      }
      
      expect(() => validateEnv(env)).not.toThrow()
    })

    it('should throw if ENVIRONMENT is production but FRONTEND_URL is missing', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        ENVIRONMENT: 'production',
      }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        expect((error as EnvValidationError).message).toContain('FRONTEND_URL')
      }
    })

    it('should throw if ENVIRONMENT is production but URLs use HTTP', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        ENVIRONMENT: 'production',
        FRONTEND_URL: 'http://store.example.com',
        ADMIN_URL: 'http://admin.example.com',
      }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        expect((error as EnvValidationError).message).toContain('HTTPS')
      }
    })

    it('should pass if ENVIRONMENT is production and URLs are HTTPS', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        ENVIRONMENT: 'production',
        FRONTEND_URL: 'https://store.example.com',
        ADMIN_URL: 'https://admin.example.com',
      }
      
      expect(() => validateEnv(env)).not.toThrow()
    })
  })

  describe('Combined validation', () => {
    it('should validate all configurations together', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        STRIPE_SECRET_KEY: 'sk_test_123',
        // Missing other Stripe vars
      }
      
      expect(() => validateEnv(env)).toThrow(EnvValidationError)
      try {
        validateEnv(env)
      } catch (error) {
        const err = error as EnvValidationError
        expect(err.message).toContain('JWT_SECRET') // Should not be in errors since it's valid
        expect(err.message).toContain('Stripe')
      }
    })

    it('should pass with complete valid configuration', () => {
      const env = {
        ...baseEnv,
        JWT_SECRET: 'a'.repeat(32),
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
        PAYPAL_CLIENT_ID: 'test_client_id',
        PAYPAL_CLIENT_SECRET: 'test_client_secret',
        EMAIL_API_KEY: 'test_api_key',
        EMAIL_PROVIDER: 'resend',
        ENVIRONMENT: 'production',
        FRONTEND_URL: 'https://store.example.com',
        ADMIN_URL: 'https://admin.example.com',
      }
      
      expect(() => validateEnv(env)).not.toThrow()
    })
  })
})

