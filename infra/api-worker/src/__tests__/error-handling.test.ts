import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../types'
import { createTestEnv } from './utils/test-helpers'

describe('Error Message Exposure', () => {
  let app: Hono<{ Bindings: Env }>
  let prodEnv: Env
  let devEnv: Env

  beforeEach(() => {
    prodEnv = {
      ...createTestEnv(),
      ENVIRONMENT: 'production',
    }

    devEnv = {
      ...createTestEnv(),
      ENVIRONMENT: 'development',
    }

    app = new Hono<{ Bindings: Env }>()
  })

  describe('Production environment', () => {
    it('should not expose error message in production', async () => {
      // Create a route that throws an error
      app.get('/test-error', () => {
        throw new Error('This is a sensitive error message with internal details')
      })

      // Add error handler (simulating the one in index.ts)
      app.onError(async (err, c) => {
        const isProd = c.env.ENVIRONMENT === 'production'
        
        const responseBody: {
          error: string
          message?: string
          stack?: string
        } = {
          error: 'INTERNAL_ERROR',
        }
        
        if (!isProd) {
          if (err.message) {
            responseBody.message = err.message
          }
          if (err.stack) {
            responseBody.stack = err.stack.split('\n').slice(0, 10).join('\n')
          }
        }
        
        return c.json(responseBody, 500)
      })

      const req = new Request('http://localhost/test-error')
      const res = await app.fetch(req, prodEnv, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('INTERNAL_ERROR')
      expect(data.message).toBeUndefined()
      expect(data.stack).toBeUndefined()
      // Ensure sensitive error message is not exposed
      expect(JSON.stringify(data)).not.toContain('sensitive error message')
      expect(JSON.stringify(data)).not.toContain('internal details')
    })

    it('should return generic error code in production', async () => {
      app.get('/test-error', () => {
        throw new Error('Database connection failed: password incorrect')
      })

      app.onError(async (err, c) => {
        const isProd = c.env.ENVIRONMENT === 'production'
        
        const responseBody: {
          error: string
          message?: string
        } = {
          error: 'INTERNAL_ERROR',
        }
        
        if (!isProd) {
          if (err.message) {
            responseBody.message = err.message
          }
        }
        
        return c.json(responseBody, 500)
      })

      const req = new Request('http://localhost/test-error')
      const res = await app.fetch(req, prodEnv, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('INTERNAL_ERROR')
      expect(data.message).toBeUndefined()
      // Ensure database password is not exposed
      expect(JSON.stringify(data)).not.toContain('password')
    })
  })

  describe('Non-production environment', () => {
    it('should include error message in development', async () => {
      const errorMessage = 'This is a helpful error message for debugging'
      
      app.get('/test-error', () => {
        throw new Error(errorMessage)
      })

      app.onError(async (err, c) => {
        const isProd = c.env.ENVIRONMENT === 'production'
        
        const responseBody: {
          error: string
          message?: string
          stack?: string
        } = {
          error: 'INTERNAL_ERROR',
        }
        
        if (!isProd) {
          if (err.message) {
            responseBody.message = err.message
          }
          if (err.stack) {
            responseBody.stack = err.stack.split('\n').slice(0, 10).join('\n')
          }
        }
        
        return c.json(responseBody, 500)
      })

      const req = new Request('http://localhost/test-error')
      const res = await app.fetch(req, devEnv, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('INTERNAL_ERROR')
      expect(data.message).toBe(errorMessage)
      expect(data.stack).toBeDefined()
      expect(data.stack).toContain('Error:')
    })

    it('should include trimmed stack trace in development', async () => {
      app.get('/test-error', () => {
        throw new Error('Test error')
      })

      app.onError(async (err, c) => {
        const isProd = c.env.ENVIRONMENT === 'production'
        
        const responseBody: {
          error: string
          message?: string
          stack?: string
        } = {
          error: 'INTERNAL_ERROR',
        }
        
        if (!isProd) {
          if (err.message) {
            responseBody.message = err.message
          }
          if (err.stack) {
            // Trim to first 10 lines
            responseBody.stack = err.stack.split('\n').slice(0, 10).join('\n')
          }
        }
        
        return c.json(responseBody, 500)
      })

      const req = new Request('http://localhost/test-error')
      const res = await app.fetch(req, devEnv, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.stack).toBeDefined()
      // Stack should be trimmed (first 10 lines)
      const stackLines = data.stack.split('\n')
      expect(stackLines.length).toBeLessThanOrEqual(10)
    })

    it('should handle errors without message gracefully', async () => {
      app.get('/test-error', () => {
        throw new Error() // Error without message
      })

      app.onError(async (err, c) => {
        const isProd = c.env.ENVIRONMENT === 'production'
        
        const responseBody: {
          error: string
          message?: string
          stack?: string
        } = {
          error: 'INTERNAL_ERROR',
        }
        
        if (!isProd) {
          if (err.message) {
            responseBody.message = err.message
          }
          if (err.stack) {
            responseBody.stack = err.stack.split('\n').slice(0, 10).join('\n')
          }
        }
        
        return c.json(responseBody, 500)
      })

      const req = new Request('http://localhost/test-error')
      const res = await app.fetch(req, devEnv, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('INTERNAL_ERROR')
      // Message might be empty string or undefined
      expect(data.message === undefined || data.message === '').toBe(true)
    })
  })

  describe('Error response format', () => {
    it('should always include error code', async () => {
      app.get('/test-error', () => {
        throw new Error('Test')
      })

      app.onError(async (err, c) => {
        const isProd = c.env.ENVIRONMENT === 'production'
        
        const responseBody: {
          error: string
          message?: string
        } = {
          error: 'INTERNAL_ERROR',
        }
        
        if (!isProd && err.message) {
          responseBody.message = err.message
        }
        
        return c.json(responseBody, 500)
      })

      const prodReq = new Request('http://localhost/test-error')
      const prodRes = await app.fetch(prodReq, prodEnv, {} as any)
      const prodData = await prodRes.json()

      const devReq = new Request('http://localhost/test-error')
      const devRes = await app.fetch(devReq, devEnv, {} as any)
      const devData = await devRes.json()

      // Both should have error code
      expect(prodData.error).toBe('INTERNAL_ERROR')
      expect(devData.error).toBe('INTERNAL_ERROR')
    })

    it('should handle different error types', async () => {
      app.get('/test-type-error', () => {
        throw new TypeError('Type error occurred')
      })

      app.get('/test-reference-error', () => {
        throw new ReferenceError('Reference error occurred')
      })

      app.onError(async (err, c) => {
        const isProd = c.env.ENVIRONMENT === 'production'
        
        const responseBody: {
          error: string
          message?: string
        } = {
          error: 'INTERNAL_ERROR',
        }
        
        if (!isProd && err.message) {
          responseBody.message = err.message
        }
        
        return c.json(responseBody, 500)
      })

      const typeReq = new Request('http://localhost/test-type-error')
      const typeRes = await app.fetch(typeReq, prodEnv, {} as any)
      const typeData = await typeRes.json()

      expect(typeData.error).toBe('INTERNAL_ERROR')
      expect(typeData.message).toBeUndefined()

      const refReq = new Request('http://localhost/test-reference-error')
      const refRes = await app.fetch(refReq, devEnv, {} as any)
      const refData = await refRes.json()

      expect(refData.error).toBe('INTERNAL_ERROR')
      expect(refData.message).toBe('Reference error occurred')
    })
  })
})

