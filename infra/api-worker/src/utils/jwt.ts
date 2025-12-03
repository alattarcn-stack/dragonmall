import * as jose from 'jose'
import type { Env } from '../types'

export interface JWTPayload {
  sub: number // user ID
  role: 'admin' | 'customer'
  iat?: number
  exp?: number
}

/**
 * Create a signed JWT token
 * @param payload - JWT payload (sub, role)
 * @param secret - JWT secret from environment
 * @param expiresIn - Expiration time in seconds (default: 24 hours)
 * @returns Signed JWT token
 */
export async function signJWT(
  payload: { sub: number; role: 'admin' | 'customer' },
  secret: string,
  expiresIn: number = 24 * 60 * 60 // 24 hours
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)
  
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secretKey)

  return jwt
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token string
 * @param secret - JWT secret from environment
 * @returns Decoded payload or null if invalid
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret)
    
    const { payload } = await jose.jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    })

    return payload as JWTPayload
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null
  }
}

/**
 * Get JWT secret from environment or throw error
 * @param env - Environment variables
 * @returns JWT secret
 * @throws Error if JWT_SECRET is not set
 */
export function getJWTSecret(env: Env): string {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }
  return env.JWT_SECRET
}

