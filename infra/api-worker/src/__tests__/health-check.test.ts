import { describe, it, expect, vi, beforeEach } from 'vitest'
import { performHealthCheck } from '../utils/health-check'
import type { Env } from '../types'

describe('Health Check', () => {
  const mockDb = {
    prepare: vi.fn(),
  }

  const baseEnv: Env = {
    D1_DATABASE: mockDb as any,
    R2_BUCKET: {} as any,
    KV_SESSIONS: {} as any,
    QUEUE_WEBHOOKS: {} as any,
    ENVIRONMENT: 'development',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic health check', () => {
    it('should return ok status with basic info', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const result = await performHealthCheck(baseEnv)

      expect(result.status).toBe('ok')
      expect(result.version).toBeDefined()
      expect(result.env).toBe('development')
      expect(result.timestamp).toBeDefined()
      expect(result.checks).toBeDefined()
    })

    it('should use VERSION env var if set', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const env = { ...baseEnv, VERSION: '1.2.3' }
      const result = await performHealthCheck(env)

      expect(result.version).toBe('1.2.3')
    })
  })

  describe('Database check', () => {
    it('should return ok if database is accessible', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const result = await performHealthCheck(baseEnv)

      expect(result.checks.database?.status).toBe('ok')
      expect(result.status).toBe('ok')
    })

    it('should return error if database query fails', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      })

      const result = await performHealthCheck(baseEnv)

      expect(result.checks.database?.status).toBe('error')
      expect(result.checks.database?.message).toContain('Database')
      expect(result.status).toBe('error')
    })

    it('should return error if database returns unexpected result', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 2 }), // Not 1
      })

      const result = await performHealthCheck(baseEnv)

      expect(result.checks.database?.status).toBe('error')
      expect(result.status).toBe('error')
    })
  })

  describe('Stripe check', () => {
    it('should return not_configured if no Stripe vars are set', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const result = await performHealthCheck(baseEnv)

      expect(result.checks.stripe?.status).toBe('not_configured')
      expect(result.status).toBe('ok') // Not critical
    })

    it('should return error if Stripe config is incomplete', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const env = {
        ...baseEnv,
        STRIPE_SECRET_KEY: 'sk_test_123',
        // Missing other keys
      }

      const result = await performHealthCheck(env)

      expect(result.checks.stripe?.status).toBe('error')
      expect(result.checks.stripe?.message).toContain('STRIPE_WEBHOOK_SECRET')
      expect(result.status).toBe('degraded') // Degraded, not error
    })

    it('should return error if Stripe key has invalid format', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const env = {
        ...baseEnv,
        STRIPE_SECRET_KEY: 'invalid_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      }

      const result = await performHealthCheck(env)

      expect(result.checks.stripe?.status).toBe('error')
      expect(result.checks.stripe?.message).toContain('format')
      expect(result.status).toBe('degraded')
    })

    it('should return ok if Stripe is properly configured', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const env = {
        ...baseEnv,
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      }

      const result = await performHealthCheck(env)

      expect(result.checks.stripe?.status).toBe('ok')
      expect(result.status).toBe('ok')
    })
  })

  describe('PayPal check', () => {
    it('should return not_configured if no PayPal vars are set', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const result = await performHealthCheck(baseEnv)

      expect(result.checks.paypal?.status).toBe('not_configured')
      expect(result.status).toBe('ok')
    })

    it('should return error if PayPal config is incomplete', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const env = {
        ...baseEnv,
        PAYPAL_CLIENT_ID: 'test_client_id',
        // Missing PAYPAL_CLIENT_SECRET
      }

      const result = await performHealthCheck(env)

      expect(result.checks.paypal?.status).toBe('error')
      expect(result.checks.paypal?.message).toContain('PAYPAL_CLIENT_SECRET')
      expect(result.status).toBe('degraded')
    })

    it('should return ok if PayPal is properly configured', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const env = {
        ...baseEnv,
        PAYPAL_CLIENT_ID: 'test_client_id',
        PAYPAL_CLIENT_SECRET: 'test_client_secret',
      }

      const result = await performHealthCheck(env)

      expect(result.checks.paypal?.status).toBe('ok')
      expect(result.status).toBe('ok')
    })
  })

  describe('Overall status', () => {
    it('should return error if database is down', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockRejectedValue(new Error('DB error')),
      })

      const result = await performHealthCheck(baseEnv)

      expect(result.status).toBe('error')
    })

    it('should return degraded if payment providers are misconfigured but DB is ok', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const env = {
        ...baseEnv,
        STRIPE_SECRET_KEY: 'invalid',
      }

      const result = await performHealthCheck(env)

      expect(result.status).toBe('degraded')
    })

    it('should return ok if everything is configured correctly', async () => {
      mockDb.prepare.mockReturnValue({
        first: vi.fn().mockResolvedValue({ test: 1 }),
      })

      const env = {
        ...baseEnv,
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
        PAYPAL_CLIENT_ID: 'test_client_id',
        PAYPAL_CLIENT_SECRET: 'test_client_secret',
      }

      const result = await performHealthCheck(env)

      expect(result.status).toBe('ok')
    })
  })
})

