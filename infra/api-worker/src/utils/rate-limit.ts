import type { KVNamespace } from '@cloudflare/workers-types'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Rate limit type/namespace identifiers
 */
export type RateLimitType = 'login' | 'signup' | 'password-reset' | 'admin-login' | 'api'

/**
 * Normalize IP address for consistent hashing
 * - Strips whitespace
 * - Converts to lowercase
 * - Trims the string
 */
export function normalizeIP(ip: string): string {
  return ip.trim().toLowerCase().replace(/\s+/g, '')
}

/**
 * Hash a string using Web Crypto API (SHA-256)
 * Returns first 16 characters of hex hash for shorter keys
 */
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.slice(0, 16) // Use first 16 chars for shorter keys
}

/**
 * Normalize and hash IP address for use in rate limit keys
 */
export async function normalizeAndHashIP(ip: string): Promise<string> {
  const normalized = normalizeIP(ip)
  // For 'unknown' or empty IPs, use a fixed hash to prevent collisions
  if (!normalized || normalized === 'unknown' || normalized === '') {
    return 'unknown'
  }
  return hashString(normalized)
}

/**
 * Build a safe rate limit key with namespace and hashed identifier
 * 
 * @param type - Rate limit type (login, signup, etc.)
 * @param identifier - IP address or email
 * @param identifierType - 'ip' or 'email'
 * @returns Safe rate limit key
 */
export async function buildRateLimitKey(
  type: RateLimitType,
  identifier: string,
  identifierType: 'ip' | 'email'
): Promise<string> {
  let safeIdentifier: string

  if (identifierType === 'ip') {
    // Hash IP addresses for privacy and collision prevention
    safeIdentifier = await normalizeAndHashIP(identifier)
  } else {
    // For emails, normalize but don't hash (we need to track per email)
    // Still normalize to prevent collisions from whitespace variations
    safeIdentifier = normalizeIP(identifier)
  }

  // Build key with namespace: rl:type:identifierType:safeIdentifier
  return `rl:${type}:${identifierType}:${safeIdentifier}`
}

/**
 * Simple rate limiting using Cloudflare KV
 * Tracks attempts per key (IP or email) with a sliding window
 * 
 * @param kv - KV namespace for storing rate limit data
 * @param type - Rate limit type (login, signup, etc.) - determines namespace prefix
 * @param identifier - IP address or email
 * @param identifierType - 'ip' or 'email'
 * @param maxAttempts - Maximum number of attempts allowed
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit result
 */
export async function checkRateLimit(
  kv: KVNamespace,
  type: RateLimitType,
  identifier: string,
  identifierType: 'ip' | 'email',
  maxAttempts: number = 5,
  windowSeconds: number = 600 // 10 minutes
): Promise<RateLimitResult> {
  const rateLimitKey = await buildRateLimitKey(type, identifier, identifierType)
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

