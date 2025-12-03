import bcrypt from 'bcryptjs'

/**
 * Hash a plain text password using bcrypt
 * @param plain - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(plain: string): Promise<string> {
  const saltRounds = 12 // Reasonable cost for security vs performance
  return bcrypt.hash(plain, saltRounds)
}

/**
 * Verify a plain text password against a hash
 * @param plain - Plain text password
 * @param hash - Hashed password from database
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

