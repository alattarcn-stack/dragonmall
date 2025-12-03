import { describe, it, expect } from 'vitest'
import type { Env } from '../types'
import { createTestEnv } from './utils/test-helpers'
import worker from '../worker'

describe('JWT_SECRET Startup Validation', () => {
  describe('Valid JWT_SECRET', () => {
    it('should succeed with valid JWT_SECRET (32+ characters)', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: 'a'.repeat(32), // Exactly 32 characters
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)

      // Should not return 500 (validation error)
      expect(res.status).not.toBe(500)
    })

    it('should succeed with JWT_SECRET longer than 32 characters', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: 'a'.repeat(64), // 64 characters
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)

      // Should not return 500 (validation error)
      expect(res.status).not.toBe(500)
    })

    it('should succeed with realistic JWT_SECRET', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: 'your-super-secret-jwt-key-minimum-32-characters-long',
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)

      // Should not return 500 (validation error)
      expect(res.status).not.toBe(500)
    })
  })

  describe('Missing JWT_SECRET', () => {
    it('should return 500 when JWT_SECRET is missing', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: undefined, // Missing
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('Server configuration error')
      expect(data.message).toContain('JWT_SECRET is required')
    })

    it('should return 500 when JWT_SECRET is empty string', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: '', // Empty string
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('Server configuration error')
      expect(data.message).toContain('JWT_SECRET is required')
    })
  })

  describe('Short JWT_SECRET', () => {
    it('should return 500 when JWT_SECRET is shorter than 32 characters', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: 'short', // Only 5 characters
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('Server configuration error')
      expect(data.message).toContain('JWT_SECRET must be at least 32 characters')
      expect(data.message).toContain('5 characters')
    })

    it('should return 500 when JWT_SECRET is exactly 31 characters', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: 'a'.repeat(31), // 31 characters (one short)
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('Server configuration error')
      expect(data.message).toContain('JWT_SECRET must be at least 32 characters')
      expect(data.message).toContain('31 characters')
    })

    it('should return 500 when JWT_SECRET is 20 characters', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: 'a'.repeat(20), // 20 characters
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('Server configuration error')
      expect(data.message).toContain('JWT_SECRET must be at least 32 characters')
      expect(data.message).toContain('20 characters')
    })
  })

  describe('Error message format', () => {
    it('should return JSON error response', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: undefined,
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)
      const contentType = res.headers.get('Content-Type')

      expect(contentType).toContain('application/json')
      
      const data = await res.json()
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
    })

    it('should include helpful error message for missing secret', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: undefined,
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)
      const data = await res.json()

      expect(data.message).toContain('JWT_SECRET is required')
      expect(data.message).toContain('minimum 32 characters')
    })

    it('should include helpful error message for short secret', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: 'short',
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)
      const data = await res.json()

      expect(data.message).toContain('JWT_SECRET must be at least 32 characters')
      expect(data.message).toContain('5 characters')
    })
  })

  describe('Validation runs on every request', () => {
    it('should validate on first request', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: undefined,
      }

      const req = new Request('http://localhost/health')
      const res = await worker.fetch(req, env, {} as any)

      expect(res.status).toBe(500)
    })

    it('should validate on subsequent requests', async () => {
      const env: Env = {
        ...createTestEnv(),
        JWT_SECRET: undefined,
      }

      // First request
      const req1 = new Request('http://localhost/health')
      const res1 = await worker.fetch(req1, env, {} as any)
      expect(res1.status).toBe(500)

      // Second request (validation should still run)
      const req2 = new Request('http://localhost/health')
      const res2 = await worker.fetch(req2, env, {} as any)
      expect(res2.status).toBe(500)
    })
  })
})

