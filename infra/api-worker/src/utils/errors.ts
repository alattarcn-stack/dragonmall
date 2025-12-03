/**
 * Standardized error response format
 * All API errors should use this format for consistency
 */

export interface StandardError {
  error: string
  message?: string
  details?: any
}

/**
 * Create a standardized error response
 * 
 * @param code - Error code (e.g., 'NOT_FOUND', 'UNAUTHORIZED', 'VALIDATION_ERROR')
 * @param message - Human-readable error message (optional)
 * @param details - Additional error details (optional)
 * @returns Standardized error object
 * 
 * @example
 * makeError('NOT_FOUND', 'Product not found')
 * makeError('VALIDATION_ERROR', 'Invalid input', { field: 'email', reason: 'Invalid format' })
 */
export function makeError(code: string, message?: string, details?: any): StandardError {
  const error: StandardError = {
    error: code,
  }

  if (message) {
    error.message = message
  }

  if (details !== undefined) {
    error.details = details
  }

  return error
}

/**
 * Common error codes used across the API
 */
export const ErrorCodes = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  BAD_REQUEST: 'BAD_REQUEST',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Payment errors
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  
  // Order errors
  ORDER_NOT_PENDING: 'ORDER_NOT_PENDING',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
} as const

