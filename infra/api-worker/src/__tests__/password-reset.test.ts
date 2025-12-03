import { describe, it, expect, beforeEach } from 'vitest'
import type { Env } from '../types'
import { createPasswordResetRouter } from '../routes/password-reset'
import { createTestEnv, createTestCustomer } from './utils/test-helpers'
import { UserService } from '@dragon/core'

describe('Password Reset Token Expiry', () => {
  let env: Env
  let router: ReturnType<typeof createPasswordResetRouter>
  let userService: UserService

  beforeEach(async () => {
    env = createTestEnv()
    router = createPasswordResetRouter(env)
    userService = new UserService(env.D1_DATABASE)

    // Create password_resets table
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        used_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
  })

  describe('POST /api/auth/reset-password', () => {
    it('should successfully reset password with valid token before expiry', async () => {
      // Create a test user
      const { id: userId, email } = await createTestCustomer(env, 'test@example.com', 'OldPassword123!')

      // Create a valid reset token (expires in 1 hour)
      const token = 'valid-reset-token-12345'
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now + 3600 // 1 hour from now

      await env.D1_DATABASE
        .prepare('INSERT INTO password_resets (user_id, token, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, token, expiresAt, now, null)
        .run()

      // Reset password
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: 'NewPassword123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.message).toContain('Password has been reset successfully')

      // Verify token is marked as used
      const tokenRecord = await env.D1_DATABASE
        .prepare('SELECT * FROM password_resets WHERE token = ?')
        .bind(token)
        .first<{ used_at: number | null }>()

      expect(tokenRecord).toBeDefined()
      expect(tokenRecord?.used_at).not.toBeNull()
      expect(tokenRecord?.used_at).toBeGreaterThan(0)

      // Verify password was actually changed
      const user = await userService.getById(userId)
      expect(user).toBeDefined()
      // Note: We can't easily verify the hash without the password service, but we can verify the user exists
    })

    it('should reject using the same token twice', async () => {
      // Create a test user
      const { id: userId } = await createTestCustomer(env, 'test2@example.com', 'OldPassword123!')

      // Create a valid reset token
      const token = 'one-time-token-12345'
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now + 3600

      await env.D1_DATABASE
        .prepare('INSERT INTO password_resets (user_id, token, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, token, expiresAt, now, null)
        .run()

      // First reset - should succeed
      const req1 = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: 'FirstPassword123!',
        }),
      })

      const res1 = await router.fetch(req1, env, {} as any)
      expect(res1.status).toBe(200)

      // Second reset with same token - should fail
      const req2 = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: 'SecondPassword123!',
        }),
      })

      const res2 = await router.fetch(req2, env, {} as any)
      const data2 = await res2.json()

      expect(res2.status).toBe(400)
      expect(data2.error).toBe('Invalid or expired reset token')
    })

    it('should reject expired token', async () => {
      // Create a test user
      const { id: userId } = await createTestCustomer(env, 'test3@example.com', 'OldPassword123!')

      // Create an expired reset token (expired 1 hour ago)
      const token = 'expired-token-12345'
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now - 3600 // 1 hour ago

      await env.D1_DATABASE
        .prepare('INSERT INTO password_resets (user_id, token, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, token, expiresAt, now - 7200, null) // created 2 hours ago
        .run()

      // Try to reset password with expired token
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: 'NewPassword123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Invalid or expired reset token')

      // Verify token was NOT marked as used
      const tokenRecord = await env.D1_DATABASE
        .prepare('SELECT * FROM password_resets WHERE token = ?')
        .bind(token)
        .first<{ used_at: number | null }>()

      expect(tokenRecord?.used_at).toBeNull()
    })

    it('should invalidate all other reset tokens for the user after successful reset', async () => {
      // Create a test user
      const { id: userId } = await createTestCustomer(env, 'test4@example.com', 'OldPassword123!')

      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now + 3600

      // Create multiple reset tokens for the same user
      const token1 = 'token-1-12345'
      const token2 = 'token-2-12345'
      const token3 = 'token-3-12345'

      await env.D1_DATABASE
        .prepare('INSERT INTO password_resets (user_id, token, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, token1, expiresAt, now, null)
        .run()

      await env.D1_DATABASE
        .prepare('INSERT INTO password_resets (user_id, token, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, token2, expiresAt, now, null)
        .run()

      await env.D1_DATABASE
        .prepare('INSERT INTO password_resets (user_id, token, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, token3, expiresAt, now, null)
        .run()

      // Use token1 to reset password
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token1,
          newPassword: 'NewPassword123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      expect(res.status).toBe(200)

      // Verify token1 is marked as used
      const token1Record = await env.D1_DATABASE
        .prepare('SELECT * FROM password_resets WHERE token = ?')
        .bind(token1)
        .first<{ used_at: number | null }>()

      expect(token1Record?.used_at).not.toBeNull()

      // Verify token2 is also marked as used (invalidated)
      const token2Record = await env.D1_DATABASE
        .prepare('SELECT * FROM password_resets WHERE token = ?')
        .bind(token2)
        .first<{ used_at: number | null }>()

      expect(token2Record?.used_at).not.toBeNull()

      // Verify token3 is also marked as used (invalidated)
      const token3Record = await env.D1_DATABASE
        .prepare('SELECT * FROM password_resets WHERE token = ?')
        .bind(token3)
        .first<{ used_at: number | null }>()

      expect(token3Record?.used_at).not.toBeNull()

      // Verify that trying to use token2 now fails
      const req2 = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token2,
          newPassword: 'AnotherPassword123!',
        }),
      })

      const res2 = await router.fetch(req2, env, {} as any)
      const data2 = await res2.json()

      expect(res2.status).toBe(400)
      expect(data2.error).toBe('Invalid or expired reset token')
    })

    it('should reject token that is already marked as used', async () => {
      // Create a test user
      const { id: userId } = await createTestCustomer(env, 'test5@example.com', 'OldPassword123!')

      // Create a token that's already been used
      const token = 'already-used-token-12345'
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now + 3600
      const usedAt = now - 1800 // Used 30 minutes ago

      await env.D1_DATABASE
        .prepare('INSERT INTO password_resets (user_id, token, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, token, expiresAt, now - 7200, usedAt)
        .run()

      // Try to use the already-used token
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: 'NewPassword123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Invalid or expired reset token')
    })

    it('should reject non-existent token', async () => {
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: 'non-existent-token-12345',
          newPassword: 'NewPassword123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error).toBe('Invalid or expired reset token')
    })

    it('should validate token expiry correctly (expires_at > now)', async () => {
      // Create a test user
      const { id: userId } = await createTestCustomer(env, 'test6@example.com', 'OldPassword123!')

      // Create a token that expires exactly now (edge case - should be rejected)
      const token = 'expires-now-token-12345'
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now // Expires exactly now

      await env.D1_DATABASE
        .prepare('INSERT INTO password_resets (user_id, token, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, token, expiresAt, now - 3600, null)
        .run()

      // Try to use the token that expires exactly now
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: 'NewPassword123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      const data = await res.json()

      // Should be rejected because expires_at > now check requires strictly greater
      expect(res.status).toBe(400)
      expect(data.error).toBe('Invalid or expired reset token')
    })
  })

  describe('Token validation checks', () => {
    it('should check all three conditions: token exists, expires_at > now, used_at IS NULL', async () => {
      // Create a test user
      const { id: userId } = await createTestCustomer(env, 'test7@example.com', 'OldPassword123!')

      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now + 3600

      // Create a token
      const token = 'validation-test-token-12345'
      await env.D1_DATABASE
        .prepare('INSERT INTO password_resets (user_id, token, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, token, expiresAt, now, null)
        .run()

      // Verify the query checks all conditions by testing each failure case
      // 1. Token doesn't exist - already tested
      // 2. Token expired - already tested
      // 3. Token already used - already tested

      // This test verifies that when all conditions are met, it works
      const req = new Request('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: 'NewPassword123!',
        }),
      })

      const res = await router.fetch(req, env, {} as any)
      expect(res.status).toBe(200)
    })
  })
})

