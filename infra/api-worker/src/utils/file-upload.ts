import type { Env } from '../types'

export interface FileUploadConfig {
  maxFileSize: number // in bytes
  allowedMimeTypes: string[]
}

/**
 * Get file upload configuration from environment
 */
export function getFileUploadConfig(env: Env): FileUploadConfig {
  // Default: 100MB
  const maxFileSize = env.MAX_FILE_SIZE 
    ? parseInt(env.MAX_FILE_SIZE, 10) 
    : 100 * 1024 * 1024 // 100MB

  // Default allowed MIME types for digital products
  const defaultMimeTypes = [
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/octet-stream', // For generic binary files
    'application/x-executable',
    'application/x-msdownload', // .exe
    'application/x-apple-diskimage', // .dmg
    'text/plain',
    'text/csv',
    'application/json',
  ]

  const allowedMimeTypes = env.ALLOWED_FILE_TYPES
    ? env.ALLOWED_FILE_TYPES.split(',').map(t => t.trim())
    : defaultMimeTypes

  return {
    maxFileSize,
    allowedMimeTypes,
  }
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return ''
  }
  return filename.substring(lastDot).toLowerCase()
}

/**
 * Map common file extensions to MIME types (for validation fallback)
 */
const extensionToMimeType: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.exe': 'application/x-msdownload',
  '.dmg': 'application/x-apple-diskimage',
  '.app': 'application/x-apple-diskimage',
}

/**
 * Validate file upload with strict MIME type checking
 * 
 * @param file - File to validate
 * @param config - File upload configuration
 * @param env - Environment (for production mode check)
 * @returns Validation result
 */
export function validateFileUpload(
  file: File,
  config: FileUploadConfig,
  env?: { ENVIRONMENT?: string }
): { valid: boolean; error?: string } {
  const isProduction = env?.ENVIRONMENT === 'production'

  // Check file size
  if (file.size > config.maxFileSize) {
    const maxSizeMB = (config.maxFileSize / (1024 * 1024)).toFixed(0)
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
    }
  }

  // Check for dangerous file extensions FIRST (security priority)
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.sh']
  const fileName = file.name.toLowerCase()
  const fileExtension = getFileExtension(file.name)
  const hasDangerousExtension = dangerousExtensions.some(ext => fileName.endsWith(ext))

  // Always reject dangerous extensions regardless of MIME type
  if (hasDangerousExtension) {
    const mimeType = file.type || ''
    // Check if MIME type is in allowed list (including application/octet-stream)
    const hasAllowedMimeType = mimeType !== '' && config.allowedMimeTypes.includes(mimeType)
    
    // If MIME type is provided and allowed, still reject in production (suspicious)
    if (hasAllowedMimeType) {
      if (isProduction) {
        return {
          valid: false,
          error: 'File type is not allowed for security reasons',
        }
      } else {
        console.warn(
          `⚠️  SECURITY WARNING: File has dangerous extension ${fileExtension} but allowed MIME type ${mimeType}.`,
          `File: ${file.name}. This will be rejected in production.`
        )
        // In development, allow but warn
      }
    } else {
      // Dangerous extension and MIME type not allowed or missing
      return {
        valid: false,
        error: 'File type is not allowed for security reasons',
      }
    }
  }

  // Strict MIME type validation
  const mimeType = file.type || ''
  // Consider application/octet-stream as "no specific MIME type" for strict validation
  const hasMimeType = mimeType !== '' && mimeType !== 'application/octet-stream'

  // In production, reject files with empty/missing MIME types
  if (isProduction && !hasMimeType) {
    return {
      valid: false,
      error: 'File MIME type is required but was not provided. Please ensure your file has a valid MIME type.',
    }
  }

  // In development, log a warning if MIME type is missing
  if (!isProduction && !hasMimeType) {
    console.warn(
      '⚠️  SECURITY WARNING: File upload with missing/empty MIME type detected.',
      `File: ${file.name}, Size: ${file.size} bytes.`,
      'This will be rejected in production. Please ensure files have proper MIME types.'
    )
  }

  // Validate MIME type against allowed list
  if (hasMimeType && !config.allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type ${mimeType} is not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`,
    }
  }

  // Additional validation: Check file extension as a second check (development only)
  if (!hasMimeType && !isProduction && fileExtension) {
    const inferredMimeType = extensionToMimeType[fileExtension]
    if (inferredMimeType && !config.allowedMimeTypes.includes(inferredMimeType)) {
      console.warn(
        `⚠️  File extension ${fileExtension} suggests MIME type ${inferredMimeType} which is not allowed.`,
        `File: ${file.name}`
      )
    }
  }

  return { valid: true }
}


