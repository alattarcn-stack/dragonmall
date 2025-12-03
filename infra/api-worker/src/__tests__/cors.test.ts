import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../types'
import { cors } from 'hono/cors'
import { createTestEnv } from './utils/test-helpers'

/**
 * Helper function to build allowed origins (same logic as in index.ts)
 */
function getAllowedOrigins(env: Env): string[] {
  const origins: string[] = []
  
  // Always allow localhost for development
  origins.push('http://localhost:3000', 'http://localhost:3001')
  
  // Add production URLs from environment variables
  if (env.FRONTEND_URL) {
    origins.push(env.FRONTEND_URL)
  }
  
  if (env.ADMIN_URL) {
    origins.push(env.ADMIN_URL)
  }
  
  return origins
}

describe('CORS Configuration', () => {
  let app: Hono<{ Bindings: Env }>
  let env: Env

  beforeEach(() => {
    env = createTestEnv()
    app = new Hono<{ Bindings: Env }>()
    
    // Apply CORS middleware with same logic as index.ts
    app.use('/*', cors({
      origin: (origin, c) => {
        const allowedOrigins = getAllowedOrigins(c.env)
        
        // Allow requests with no origin (e.g., curl, server-to-server, Postman)
        if (!origin) {
          return true
        }
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          return true
        }
        
        // Reject all other origins
        return false
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
    }))
    
    // Add a test route
    app.get('/test', (c) => {
      return c.json({ message: 'success' })
    })
  })

  describe('Development origins (always allowed)', () => {
    it('should allow http://localhost:3000', async () => {
      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'http://localhost:3000',
        },
      })

      const res = await app.fetch(req, env, {} as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('should allow http://localhost:3001', async () => {
      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'http://localhost:3001',
        },
      })

      const res = await app.fetch(req, env, {} as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3001')
    })
  })

  describe('Production origins (from environment)', () => {
    it('should allow FRONTEND_URL when set', async () => {
      const prodEnv = {
        ...env,
        FRONTEND_URL: 'https://store.example.com',
      }

      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'https://store.example.com',
        },
      })

      const res = await app.fetch(req, prodEnv, {} as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://store.example.com')
    })

    it('should allow ADMIN_URL when set', async () => {
      const prodEnv = {
        ...env,
        ADMIN_URL: 'https://admin.example.com',
      }

      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'https://admin.example.com',
        },
      })

      const res = await app.fetch(req, prodEnv, {} as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://admin.example.com')
    })

    it('should allow both FRONTEND_URL and ADMIN_URL when both are set', async () => {
      const prodEnv = {
        ...env,
        FRONTEND_URL: 'https://store.example.com',
        ADMIN_URL: 'https://admin.example.com',
      }

      // Test FRONTEND_URL
      const req1 = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'https://store.example.com',
        },
      })
      const res1 = await app.fetch(req1, prodEnv, {} as any)
      expect(res1.status).toBe(200)
      expect(res1.headers.get('Access-Control-Allow-Origin')).toBe('https://store.example.com')

      // Test ADMIN_URL
      const req2 = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'https://admin.example.com',
        },
      })
      const res2 = await app.fetch(req2, prodEnv, {} as any)
      expect(res2.status).toBe(200)
      expect(res2.headers.get('Access-Control-Allow-Origin')).toBe('https://admin.example.com')
    })

    it('should allow localhost even when production URLs are set', async () => {
      const prodEnv = {
        ...env,
        FRONTEND_URL: 'https://store.example.com',
        ADMIN_URL: 'https://admin.example.com',
      }

      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'http://localhost:3000',
        },
      })

      const res = await app.fetch(req, prodEnv, {} as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    })
  })

  describe('Rejected origins', () => {
    it('should reject unknown origin', async () => {
      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'https://evil.com',
        },
      })

      const res = await app.fetch(req, env, {} as any)
      
      expect(res.status).toBe(200) // Request succeeds, but CORS headers are not set
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('should reject origin not in allowed list even with production URLs set', async () => {
      const prodEnv = {
        ...env,
        FRONTEND_URL: 'https://store.example.com',
        ADMIN_URL: 'https://admin.example.com',
      }

      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'https://attacker.com',
        },
      })

      const res = await app.fetch(req, prodEnv, {} as any)
      
      expect(res.status).toBe(200) // Request succeeds, but CORS headers are not set
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
  })

  describe('No origin (server-to-server requests)', () => {
    it('should allow requests with no Origin header (curl, Postman, server-to-server)', async () => {
      const req = new Request('http://localhost/test', {
        method: 'GET',
        // No Origin header
      })

      const res = await app.fetch(req, env, {} as any)
      
      expect(res.status).toBe(200)
      // When origin is null, CORS middleware should allow it
      // The Access-Control-Allow-Origin header may be set to '*' or the origin
      // depending on the CORS library implementation
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('should allow OPTIONS preflight with no origin', async () => {
      const req = new Request('http://localhost/test', {
        method: 'OPTIONS',
        // No Origin header
      })

      const res = await app.fetch(req, env, {} as any)
      
      expect(res.status).toBe(200)
    })
  })

  describe('OPTIONS preflight requests', () => {
    it('should handle preflight request from allowed origin', async () => {
      const req = new Request('http://localhost/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      })

      const res = await app.fetch(req, env, {} as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    })

    it('should reject preflight request from disallowed origin', async () => {
      const req = new Request('http://localhost/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil.com',
          'Access-Control-Request-Method': 'POST',
        },
      })

      const res = await app.fetch(req, env, {} as any)
      
      expect(res.status).toBe(200) // OPTIONS request succeeds
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
  })

  describe('Environment variable combinations', () => {
    it('should work with only FRONTEND_URL set', async () => {
      const envWithFrontend = {
        ...env,
        FRONTEND_URL: 'https://store.example.com',
      }

      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'https://store.example.com',
        },
      })

      const res = await app.fetch(req, envWithFrontend, {} as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://store.example.com')
    })

    it('should work with only ADMIN_URL set', async () => {
      const envWithAdmin = {
        ...env,
        ADMIN_URL: 'https://admin.example.com',
      }

      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'https://admin.example.com',
        },
      })

      const res = await app.fetch(req, envWithAdmin, {} as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://admin.example.com')
    })

    it('should work with neither FRONTEND_URL nor ADMIN_URL set (dev mode)', async () => {
      const req = new Request('http://localhost/test', {
        method: 'GET',
        headers: {
          'Origin': 'http://localhost:3000',
        },
      })

      const res = await app.fetch(req, env, {} as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    })
  })
})

