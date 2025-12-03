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
          'X-Seed-Secret': 'test-secret',
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
          'X-Seed-Secret': 'test-secret-123',
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

    it('should return 401 if secret is missing', async () => {
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

      expect(res.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(data.message).toContain('Invalid or missing seed secret')
    })

    it('should return 401 if secret is incorrect', async () => {
      router = createAdminSeedRouter(env)

      const req = new Request('http://localhost/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seed-Secret': 'wrong-secret',
        },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'Admin123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should accept secret from X-Seed-Secret header', async () => {
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

