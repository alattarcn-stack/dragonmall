import { Hono } from 'hono'
import type { Env } from '../types'
import { UserService } from '@dragon/core'
import { hashPassword } from '../utils/password'
import { sendPasswordResetEmail } from '../utils/email'
import { logError, logInfo } from '../utils/logging'
import { AuthSignupSchema, formatValidationError } from '../validation/schemas'
import { makeError, ErrorCodes } from '../utils/errors'
import { z } from 'zod'

// Validation schemas
const RequestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email format'),
})

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

/**
 * Generate a secure random token for password reset
 */
function generateResetToken(): string {
  // Generate a cryptographically secure random token
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function createPasswordResetRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const userService = new UserService(env.D1_DATABASE)

  /**
   * POST /api/auth/request-password-reset
   * Request a password reset email
   */
  router.post('/request-password-reset', async (c) => {
    try {
      const body = await c.req.json()

      // Validate input
      const validationResult = RequestPasswordResetSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { email } = validationResult.data

      // Check if user exists
      const user = await userService.getByEmail(email)

      // Always return success (don't leak whether email exists)
      // But only send email if user exists
      if (user && user.isActive === 1) {
        // Generate secure token
        const token = generateResetToken()
        const expiresAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        const createdAt = Math.floor(Date.now() / 1000)

        // Store token in database
        await env.D1_DATABASE
          .prepare(
            'INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)'
          )
          .bind(user.id, token, expiresAt, createdAt)
          .run()

        // Build reset link
        const frontendUrl = env.FRONTEND_URL || env.FRONTEND_BASE_URL || 'http://localhost:3000'
        const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`

        // Send email
        try {
          await sendPasswordResetEmail(email, resetLink, env)
          logInfo('Password reset requested', { email, userId: user.id }, env)
        } catch (emailError) {
          logError('Failed to send password reset email', emailError, { email, userId: user.id }, env)
          // Don't fail the request if email fails - token is still created
        }
      }

      // Always return success
      return c.json({
        data: {
          message: 'If an account with that email exists, a password reset link has been sent.',
        },
      }, 200)
    } catch (error) {
      logError('Error requesting password reset', error, {}, env)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to process password reset request'), 500)
    }
  })

  /**
   * POST /api/auth/reset-password
   * Reset password using token
   */
  router.post('/reset-password', async (c) => {
    try {
      const body = await c.req.json()

      // Validate input
      const validationResult = ResetPasswordSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { token, newPassword } = validationResult.data

      // Find token in database
      const tokenResult = await env.D1_DATABASE
        .prepare(
          'SELECT * FROM password_resets WHERE token = ? AND expires_at > ? AND used_at IS NULL'
        )
        .bind(token, Math.floor(Date.now() / 1000))
        .first<{
          id: number
          user_id: number
          token: string
          expires_at: number
          created_at: number
          used_at: number | null
        }>()

      if (!tokenResult) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, 'Invalid or expired reset token'), 400)
      }

      // Get user
      const user = await userService.getById(tokenResult.user_id)
      if (!user || user.isActive === 0) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, 'User not found or inactive'), 400)
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword)

      // Update user password
      await userService.update(user.id, {
        ...user,
        passwordHash,
      })

      const now = Math.floor(Date.now() / 1000)

      // Mark token as used
      await env.D1_DATABASE
        .prepare('UPDATE password_resets SET used_at = ? WHERE id = ?')
        .bind(now, tokenResult.id)
        .run()

      // Invalidate all other reset tokens for this user (security best practice)
      // This ensures only one password reset can be used at a time
      await env.D1_DATABASE
        .prepare(
          'UPDATE password_resets SET used_at = ? WHERE user_id = ? AND id != ? AND used_at IS NULL'
        )
        .bind(now, user.id, tokenResult.id)
        .run()

      logInfo('Password reset completed', { userId: user.id }, env)

      return c.json({
        data: {
          message: 'Password has been reset successfully. You can now log in with your new password.',
        },
      }, 200)
    } catch (error) {
      logError('Error resetting password', error, {}, env)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to reset password'), 500)
    }
  })

  return router
}

