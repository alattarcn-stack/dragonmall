import type { KVNamespace } from '@cloudflare/workers-types'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Simple rate limiting using Cloudflare KV
 * Tracks attempts per key (IP or email) with a sliding window
 * 
 * @param kv - KV namespace for storing rate limit data
 * @param key - Unique key (e.g., IP address or email)
 * @param maxAttempts - Maximum number of attempts allowed
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit result
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  maxAttempts: number = 5,
  windowSeconds: number = 600 // 10 minutes
): Promise<RateLimitResult> {
  const rateLimitKey = `rate_limit:${key}`
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  // Get existing attempts
  const existing = await kv.get(rateLimitKey, 'json') as { attempts: number[]; resetAt: number } | null

  if (!existing) {
    // First attempt - create new entry
    const resetAt = now + windowMs
    await kv.put(rateLimitKey, JSON.stringify({
      attempts: [now],
      resetAt,
    }), { expirationTtl: windowSeconds })
    
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: Math.floor(resetAt / 1000),
    }
  }

  // Filter out attempts outside the window
  const windowStart = now - windowMs
  const recentAttempts = existing.attempts.filter((timestamp: number) => timestamp > windowStart)

  if (recentAttempts.length >= maxAttempts) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: Math.floor(existing.resetAt / 1000),
    }
  }

  // Add current attempt
  recentAttempts.push(now)
  const resetAt = Math.max(existing.resetAt, now + windowMs)

  await kv.put(rateLimitKey, JSON.stringify({
    attempts: recentAttempts,
    resetAt,
  }), { expirationTtl: windowSeconds })

  return {
    allowed: true,
    remaining: maxAttempts - recentAttempts.length,
    resetAt: Math.floor(resetAt / 1000),
  }
}

