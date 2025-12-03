import type { Context, Next } from 'hono'
import type { Env } from '../types'
import { makeError, ErrorCodes } from '../utils/errors'

/**
 * Request size limit configuration
 */
export interface RequestSizeLimitConfig {
  /**
   * Maximum JSON body size in bytes (default: 5MB)
   */
  maxJsonBodySize: number
  
  /**
   * Maximum form data body size in bytes (default: 10MB for file uploads)
   * Note: File upload endpoints should have their own validation
   */
  maxFormDataSize: number
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RequestSizeLimitConfig = {
  maxJsonBodySize: 5 * 1024 * 1024, // 5MB
  maxFormDataSize: 10 * 1024 * 1024, // 10MB
}

/**
 * Routes that should be exempt from size limits
 * These routes handle file uploads and have their own size validation
 */
const EXEMPT_ROUTES = [
  '/api/admin/products/:id/files',
  '/api/admin/products/*/files',
]

/**
 * Check if a route path matches an exempt pattern
 */
function isExemptRoute(path: string): boolean {
  return EXEMPT_ROUTES.some((pattern) => {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '[^/]+') // * matches any non-slash characters
      .replace(/:[^/]+/g, '[^/]+') // :param matches any non-slash characters
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(path)
  })
}

/**
 * Check if request has multipart/form-data content type
 */
function isFormDataRequest(contentType: string | null): boolean {
  return contentType?.startsWith('multipart/form-data') ?? false
}

/**
 * Get request body size from Content-Length header
 * 
 * Note: We rely on Content-Length header for efficiency.
 * If Content-Length is not available, we cannot check size
 * without consuming the request body, which would break
 * downstream handlers. In such cases, we skip the check
 * and let the application handle oversized bodies.
 */
function getRequestBodySize(request: Request): number | null {
  const contentLength = request.headers.get('Content-Length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (!isNaN(size) && size > 0) {
      return size
    }
  }
  return null
}

/**
 * Request size limit middleware
 * 
 * Limits request body size to prevent large payloads from consuming
 * too much memory or causing worker timeouts.
 * 
 * - JSON bodies: Limited to maxJsonBodySize (default 5MB)
 * - Form data: Limited to maxFormDataSize (default 10MB)
 * - File upload endpoints are exempt (they have their own validation)
 * 
 * Returns 413 Payload Too Large if limit is exceeded.
 */
export function requestSizeLimit(config: Partial<RequestSizeLimitConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Only check POST, PUT, PATCH requests (they have bodies)
    const method = c.req.method
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return next()
    }

    // Check if route is exempt (file upload endpoints)
    const path = new URL(c.req.url).pathname
    if (isExemptRoute(path)) {
      return next()
    }

    const contentType = c.req.header('Content-Type')
    const isFormData = isFormDataRequest(contentType)

    // Get request body size from Content-Length header
    const bodySize = getRequestBodySize(c.req.raw)

    if (bodySize !== null) {
      // Check size limit based on content type
      const maxSize = isFormData ? finalConfig.maxFormDataSize : finalConfig.maxJsonBodySize
      
      if (bodySize > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
        const bodySizeMB = (bodySize / (1024 * 1024)).toFixed(1)
        
        return c.json(
          makeError(
            ErrorCodes.BAD_REQUEST,
            `Request body too large. Maximum size is ${maxSizeMB}MB, but received ${bodySizeMB}MB`,
            {
              maxSize,
              receivedSize: bodySize,
              contentType: contentType || 'unknown',
            }
          ),
          413 // Payload Too Large
        )
      }
    }
    // Note: If Content-Length is not available, we skip the check
    // to avoid consuming the request body. Most HTTP clients
    // include Content-Length for POST/PUT/PATCH requests.

    return next()
  }
}

