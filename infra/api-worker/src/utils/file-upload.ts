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
 * Validate file upload
 */
export function validateFileUpload(
  file: File,
  config: FileUploadConfig
): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > config.maxFileSize) {
    const maxSizeMB = (config.maxFileSize / (1024 * 1024)).toFixed(0)
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
    }
  }

  // Check MIME type
  if (!config.allowedMimeTypes.includes(file.type)) {
    // Also check if it's an empty string (some browsers don't set MIME type)
    if (file.type && file.type !== '') {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`,
      }
    }
    // If MIME type is empty, we'll allow it but log a warning
    // In production, you might want to be stricter
  }

  // Check for dangerous file extensions (additional safety)
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js']
  const fileName = file.name.toLowerCase()
  const hasDangerousExtension = dangerousExtensions.some(ext => fileName.endsWith(ext))

  if (hasDangerousExtension && !config.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'File type is not allowed for security reasons',
    }
  }

  return { valid: true }
}

