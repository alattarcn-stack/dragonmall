import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit, normalizeIP, hashString, normalizeAndHashIP, buildRateLimitKey } from '../utils/rate-limit'
import type { KVNamespace } from '@cloudflare/workers-types'

// Mock KV namespace
class MockKVNamespace implements KVNamespace {
  private store: Map<string, string> = new Map()

  async get(key: string, type?: 'text' | 'json'): Promise<string | any | null> {
    const value = this.store.get(key)
    if (!value) return null
    
    if (type === 'json') {
      return JSON.parse(value)
    }
    return value
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  list(): Promise<{ keys: Array<{ name: string }> }> {
    return Promise.resolve({ keys: Array.from(this.store.keys()).map(k => ({ name: k })) })
  }

  getWithMetadata(): Promise<{ value: string | null; metadata: any }> {
    return Promise.resolve({ value: null, metadata: null })
  }
}

describe('Rate Limit Key Safety', () => {
  let kv: MockKVNamespace

  beforeEach(() => {
    kv = new MockKVNamespace()
  })

  describe('IP normalization', () => {
    it('should normalize IP addresses consistently', () => {
      expect(normalizeIP('192.168.1.1')).toBe('192.168.1.1')
      expect(normalizeIP('  192.168.1.1  ')).toBe('192.168.1.1')
      expect(normalizeIP('192.168.1.1  ')).toBe('192.168.1.1')
      expect(normalizeIP('  192.168.1.1')).toBe('192.168.1.1')
      expect(normalizeIP('192.168.1.1\n')).toBe('192.168.1.1')
      expect(normalizeIP('192.168.1.1\t')).toBe('192.168.1.1')
      expect(normalizeIP('192.168.1.1   ')).toBe('192.168.1.1')
    })

    it('should handle IPv6 addresses', () => {
      expect(normalizeIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
      expect(normalizeIP('  2001:0db8:85a3:0000:0000:8a2e:0370:7334  ')).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
    })

    it('should handle unknown IPs', () => {
      expect(normalizeIP('unknown')).toBe('unknown')
      expect(normalizeIP('  unknown  ')).toBe('unknown')
    })
  })

  describe('IP hashing', () => {
    it('should hash IP addresses consistently', async () => {
      const ip1 = '192.168.1.1'
      const ip2 = '192.168.1.1'
      const ip3 = '192.168.1.2'

      const hash1 = await normalizeAndHashIP(ip1)
      const hash2 = await normalizeAndHashIP(ip2)
      const hash3 = await normalizeAndHashIP(ip3)

      // Same IP should produce same hash
      expect(hash1).toBe(hash2)
      // Different IPs should produce different hashes
      expect(hash1).not.toBe(hash3)
    })

    it('should handle equivalent IP strings with different formatting', async () => {
      const ip1 = '192.168.1.1'
      const ip2 = '  192.168.1.1  '
      const ip3 = '192.168.1.1\n'

      const hash1 = await normalizeAndHashIP(ip1)
      const hash2 = await normalizeAndHashIP(ip2)
      const hash3 = await normalizeAndHashIP(ip3)

      // All should produce the same hash after normalization
      expect(hash1).toBe(hash2)
      expect(hash1).toBe(hash3)
    })

    it('should handle unknown IPs consistently', async () => {
      const hash1 = await normalizeAndHashIP('unknown')
      const hash2 = await normalizeAndHashIP('  unknown  ')
      const hash3 = await normalizeAndHashIP('')

      // All unknown IPs should map to 'unknown'
      expect(hash1).toBe('unknown')
      expect(hash2).toBe('unknown')
      expect(hash3).toBe('unknown')
    })
  })

  describe('Rate limit key generation', () => {
    it('should generate different keys for different rate limit types', async () => {
      const ip = '192.168.1.1'
      
      const loginKey = await buildRateLimitKey('login', ip, 'ip')
      const signupKey = await buildRateLimitKey('signup', ip, 'ip')
      const adminLoginKey = await buildRateLimitKey('admin-login', ip, 'ip')

      expect(loginKey).not.toBe(signupKey)
      expect(loginKey).not.toBe(adminLoginKey)
      expect(signupKey).not.toBe(adminLoginKey)

      // All should have correct prefixes
      expect(loginKey).toMatch(/^rl:login:ip:/)
      expect(signupKey).toMatch(/^rl:signup:ip:/)
      expect(adminLoginKey).toMatch(/^rl:admin-login:ip:/)
    })

    it('should generate different keys for IP vs email', async () => {
      const identifier = 'test@example.com'
      
      const ipKey = await buildRateLimitKey('login', identifier, 'ip')
      const emailKey = await buildRateLimitKey('login', identifier, 'email')

      expect(ipKey).not.toBe(emailKey)
      expect(ipKey).toMatch(/^rl:login:ip:/)
      expect(emailKey).toMatch(/^rl:login:email:/)
    })

    it('should hash IP addresses in keys', async () => {
      const ip = '192.168.1.1'
      const key = await buildRateLimitKey('login', ip, 'ip')

      // Key should contain hash, not raw IP
      expect(key).not.toContain('192.168.1.1')
      expect(key).toMatch(/^rl:login:ip:[a-f0-9]{16}$/)
    })

    it('should not hash email addresses in keys', async () => {
      const email = 'test@example.com'
      const key = await buildRateLimitKey('login', email, 'email')

      // Key should contain normalized email, not hash
      expect(key).toContain('test@example.com')
      expect(key).toMatch(/^rl:login:email:test@example\.com$/)
    })

    it('should normalize email addresses in keys', async () => {
      const email1 = 'test@example.com'
      const email2 = '  test@example.com  '
      const email3 = 'test@example.com\n'

      const key1 = await buildRateLimitKey('login', email1, 'email')
      const key2 = await buildRateLimitKey('login', email2, 'email')
      const key3 = await buildRateLimitKey('login', email3, 'email')

      // All should produce the same key after normalization
      expect(key1).toBe(key2)
      expect(key1).toBe(key3)
    })
  })

  describe('Rate limit functionality with safe keys', () => {
    it('should track rate limits separately for different types', async () => {
      const ip = '192.168.1.1'

      // Make 3 login attempts
      for (let i = 0; i < 3; i++) {
        const result = await checkRateLimit(kv, 'login', ip, 'ip', 5, 600)
        expect(result.allowed).toBe(true)
      }

      // Make 3 signup attempts (should be separate from login)
      for (let i = 0; i < 3; i++) {
        const result = await checkRateLimit(kv, 'signup', ip, 'ip', 5, 600)
        expect(result.allowed).toBe(true)
      }

      // Both should still have remaining attempts
      const loginResult = await checkRateLimit(kv, 'login', ip, 'ip', 5, 600)
      const signupResult = await checkRateLimit(kv, 'signup', ip, 'ip', 5, 600)

      expect(loginResult.remaining).toBe(1) // 5 - 4 = 1
      expect(signupResult.remaining).toBe(1) // 5 - 4 = 1
    })

    it('should handle equivalent IP strings without collisions', async () => {
      const ip1 = '192.168.1.1'
      const ip2 = '  192.168.1.1  '
      const ip3 = '192.168.1.1\n'

      // Make 3 attempts with different IP formats
      // All should map to the same rate limit (same hash)
      await checkRateLimit(kv, 'login', ip1, 'ip', 5, 600)
      await checkRateLimit(kv, 'login', ip2, 'ip', 5, 600)
      const result3 = await checkRateLimit(kv, 'login', ip3, 'ip', 5, 600)

      // All should share the same rate limit (same hash)
      // After 3 attempts, remaining should be 2 (5 - 3 = 2)
      expect(result3.remaining).toBe(2)
    })

    it('should handle different IPs separately', async () => {
      const ip1 = '192.168.1.1'
      const ip2 = '192.168.1.2'

      const result1 = await checkRateLimit(kv, 'login', ip1, 'ip', 5, 600)
      const result2 = await checkRateLimit(kv, 'login', ip2, 'ip', 5, 600)

      // Different IPs should have separate rate limits
      expect(result1.remaining).toBe(4)
      expect(result2.remaining).toBe(4)
    })

    it('should enforce rate limits correctly', async () => {
      const ip = '192.168.1.1'

      // Make 5 attempts (max allowed)
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit(kv, 'login', ip, 'ip', 5, 600)
        expect(result.allowed).toBe(true)
      }

      // 6th attempt should be blocked
      const blocked = await checkRateLimit(kv, 'login', ip, 'ip', 5, 600)
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
    })
  })
})

