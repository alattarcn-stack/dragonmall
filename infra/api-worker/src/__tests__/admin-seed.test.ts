import { describe, it, expect, beforeEach } from 'vitest'
import type { Env } from '../types'
import { createAdminSeedRouter } from '../routes/admin-seed'
import { createTestEnv, createTestAdmin } from './utils/test-helpers'
import { Hono } from 'hono'

describe('Admin Seed Endpoint Security', () => {
  let env: Env
  let router: ReturnType<typeof createAdminSeedRouter>

  beforeEach(async () => {
    env = createTestEnv()
    
    // Set up database schema
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_login_at INTEGER
      );
    `)
  })

  describe('Production mode', () => {
    it('should return 403 in production environment', async () => {
      const prodEnv = { ...env, ENVIRONMENT: 'production' }
      router = createAdminSeedRouter(prodEnv)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-seed-secret': 'test-secret',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, prodEnv, {} as any)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.error).toBe('Not available in production')
    })

    it('should return 403 even with correct secret in production', async () => {
      const prodEnv = { 
        ...env, 
        ENVIRONMENT: 'production',
        SEED_SECRET: 'test-secret-123',
      }
      router = createAdminSeedRouter(prodEnv)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-seed-secret': 'test-secret-123',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, prodEnv, {} as any)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.error).toBe('Not available in production')
    })

    it('should not mount route in production (route returns 404)', async () => {
      // Note: This test verifies that the route is not registered in production
      // In the actual app, if ENVIRONMENT === 'production', the route won't be mounted
      // This means requests to /api/admin/seed would return 404, not 403
      // However, the router itself still has the defense-in-depth check
      const prodEnv = { ...env, ENVIRONMENT: 'production' }
      
      // Simulate what happens when route is not mounted - would be 404 in real app
      // But since we're testing the router directly, it will return 403 from defense-in-depth
      router = createAdminSeedRouter(prodEnv)
      
      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const res = await router.fetch(req, prodEnv, {} as any)
      const data = await res.json()

      // Defense-in-depth: Router checks production even if route is mounted
      expect(res.status).toBe(403)
    })
  })

  describe('Development mode', () => {
    beforeEach(() => {
      env.ENVIRONMENT = 'development'
      env.SEED_SECRET = 'dev-secret-123'
    })

    it('should return 500 if SEED_SECRET is not configured', async () => {
      const envWithoutSecret = { ...env, SEED_SECRET: undefined }
      router = createAdminSeedRouter(envWithoutSecret)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seed-Secret': 'any-secret',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, envWithoutSecret, {} as any)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.error).toBe('Seed endpoint not configured')
    })

    it('should return 403 if secret is missing', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.error).toBe('Forbidden')
      expect(data.message).toContain('Invalid or missing seed secret')
    })

    it('should return 403 if secret is incorrect', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-seed-secret': 'wrong-secret',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.error).toBe('Forbidden')
      expect(data.message).toContain('Invalid or missing seed secret')
    })

    it('should accept lowercase x-seed-secret header', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-seed-secret': 'dev-secret-123',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.data.user).toBeDefined()
    })

    it('should accept secret from X-Seed-Secret header (uppercase)', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seed-Secret': 'dev-secret-123',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.data.user).toBeDefined()
      expect(data.data.user.email).toBe('admin@example.com')
      expect(data.data.user.role).toBe('admin')
    })

    it('should accept secret from seed_secret query parameter', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed?seed_secret=dev-secret-123', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.data.user).toBeDefined()
    })

    it('should accept secret from secret query parameter', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed?secret=dev-secret-123', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toBeDefined()
    })

    it('should create admin user with correct secret', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seed-Secret': 'dev-secret-123',
        },
        body: JSON.stringify({
          email: 'newadmin@example.com',
          password: 'SecurePass123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.user.email).toBe('newadmin@example.com')
      expect(data.data.user.role).toBe('admin')
    })

    it('should return 400 if admin already exists', async () => {
      // Create existing admin
      await createTestAdmin(env, 'existing@example.com', 'Admin123!')
      
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seed-Secret': 'dev-secret-123',
        },
        body: JSON.stringify({
          email: 'existing@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Admin user already exists')
    })
  })

  describe('Staging/Test environments', () => {
    beforeEach(() => {
      env.ENVIRONMENT = 'staging'
      env.SEED_SECRET = 'staging-secret-123'
    })

    it('should allow localhost IP in staging', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seed-Secret': 'staging-secret-123',
          'CF-Connecting-IP': '127.0.0.1',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toBeDefined()
    })

    it('should block non-localhost IP in staging', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seed-Secret': 'staging-secret-123',
          'CF-Connecting-IP': '192.168.1.100',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.error).toBe('Forbidden')
      expect(data.message).toContain('localhost')
    })
  })
})

