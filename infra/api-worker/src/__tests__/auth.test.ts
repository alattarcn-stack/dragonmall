import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../types'
import { createAdminAuthRouter } from '../routes/admin-auth'
import { createCustomerAuthRouter } from '../routes/customer-auth'
import { createTestEnv, createTestAdmin, createTestCustomer } from './utils/test-helpers'

describe('Admin Auth API', () => {
  let env: Env
  let app: Hono<{ Bindings: Env }>

  beforeEach(() => {
    env = createTestEnv()
    app = new Hono<{ Bindings: Env }>()
  })

  describe('POST /api/admin/auth/login', () => {
    it('should return 200 with correct credentials', async () => {
      const { email, password } = await createTestAdmin(env)

      const router = createAdminAuthRouter(env)
      const req = new Request('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email, password }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.data.user).toBeDefined()
      expect(data.data.user.email).toBe(email)
      expect(data.data.user.role).toBe('admin')
    })

    it('should return 401 with bad password', async () => {
      const { email } = await createTestAdmin(env)

      const router = createAdminAuthRouter(env)
      const req = new Request('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email, password: 'WrongPassword123!' }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Invalid credentials')
    })

    it('should return 401 with non-existent email', async () => {
      const router = createAdminAuthRouter(env)
      const req = new Request('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email: 'nonexistent@example.com', password: 'AnyPassword123!' }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Invalid credentials')
    })

    it('should return 400 with validation error for invalid email', async () => {
      const router = createAdminAuthRouter(env)
      const req = new Request('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email: 'invalid-email', password: 'Password123!' }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })
  })
})

describe('Customer Auth API', () => {
  let env: Env

  beforeEach(() => {
    env = createTestEnv()
  })

  describe('POST /api/auth/signup', () => {
    it('should create a new customer account', async () => {
      const router = createCustomerAuthRouter(env)
      const req = new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          email: 'newcustomer@example.com',
          password: 'Customer123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.data).toBeDefined()
      expect(data.data.user).toBeDefined()
      expect(data.data.user.email).toBe('newcustomer@example.com')
      expect(data.data.user.role).toBe('customer')
    })

    it('should return 400 for invalid email', async () => {
      const router = createCustomerAuthRouter(env)
      const req = new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'Customer123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for weak password', async () => {
      const router = createCustomerAuthRouter(env)
      const req = new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'weak',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for duplicate email', async () => {
      await createTestCustomer(env, 'existing@example.com')

      const router = createCustomerAuthRouter(env)
      const req = new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          email: 'existing@example.com',
          password: 'Customer123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Email already registered')
    })
  })

  describe('POST /api/auth/login', () => {
    it('should return 200 with correct credentials', async () => {
      const { email, password } = await createTestCustomer(env)

      const router = createCustomerAuthRouter(env)
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email, password }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toBeDefined()
      expect(data.data.user).toBeDefined()
      expect(data.data.user.email).toBe(email)
      expect(data.data.user.role).toBe('customer')
    })

    it('should return 401 with bad password', async () => {
      const { email } = await createTestCustomer(env)

      const router = createCustomerAuthRouter(env)
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email, password: 'WrongPassword123!' }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(401)
      expect(data.error).toBe('Invalid credentials')
    })
  })
})

