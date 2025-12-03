import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateFileUpload, getFileUploadConfig } from '../utils/file-upload'
import type { Env } from '../types'

// Mock File class for testing
class MockFile implements File {
  name: string
  size: number
  type: string
  lastModified: number
  webkitRelativePath: string

  constructor(
    name: string,
    size: number,
    type: string = '',
    lastModified: number = Date.now()
  ) {
    this.name = name
    this.size = size
    this.type = type
    this.lastModified = lastModified
    this.webkitRelativePath = ''
  }

  slice(): Blob {
    throw new Error('Not implemented')
  }

  stream(): ReadableStream<Uint8Array> {
    throw new Error('Not implemented')
  }

  text(): Promise<string> {
    throw new Error('Not implemented')
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    throw new Error('Not implemented')
  }
}

describe('File Upload Validation', () => {
  let config: ReturnType<typeof getFileUploadConfig>
  let devEnv: Env
  let prodEnv: Env

  beforeEach(() => {
    devEnv = {
      D1_DATABASE: {} as any,
      R2_BUCKET: {} as any,
      KV_SESSIONS: {} as any,
      QUEUE_WEBHOOKS: {} as any,
      ENVIRONMENT: 'development',
    }

    prodEnv = {
      D1_DATABASE: {} as any,
      R2_BUCKET: {} as any,
      KV_SESSIONS: {} as any,
      QUEUE_WEBHOOKS: {} as any,
      ENVIRONMENT: 'production',
    }

    config = getFileUploadConfig(devEnv)
  })

  describe('Valid MIME types', () => {
    it('should accept file with valid MIME type', () => {
      const file = new MockFile('document.pdf', 1024 * 1024, 'application/pdf')
      const result = validateFileUpload(file, config, devEnv)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept file with valid MIME type in production', () => {
      const file = new MockFile('document.pdf', 1024 * 1024, 'application/pdf')
      const result = validateFileUpload(file, config, prodEnv)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept multiple valid MIME types', () => {
      const files = [
        new MockFile('archive.zip', 1024 * 1024, 'application/zip'),
        new MockFile('data.csv', 1024, 'text/csv'),
        new MockFile('data.json', 1024, 'application/json'),
        new MockFile('document.txt', 1024, 'text/plain'),
      ]

      files.forEach(file => {
        const result = validateFileUpload(file, config, devEnv)
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('Invalid MIME types', () => {
    it('should reject file with disallowed MIME type', () => {
      const file = new MockFile('script.js', 1024, 'application/javascript')
      const result = validateFileUpload(file, config, devEnv)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('is not allowed')
    })

    it('should reject file with disallowed MIME type in production', () => {
      const file = new MockFile('script.js', 1024, 'application/javascript')
      const result = validateFileUpload(file, config, prodEnv)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('is not allowed')
    })

    it('should reject dangerous file extensions even with allowed MIME type in production', () => {
      // Some browsers might report .exe files with application/octet-stream
      const file = new MockFile('malware.exe', 1024, 'application/octet-stream')
      const result = validateFileUpload(file, config, prodEnv)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('not allowed for security reasons')
    })
  })

  describe('Empty/missing MIME types', () => {
    it('should reject file with empty MIME type in production', () => {
      const file = new MockFile('document.pdf', 1024 * 1024, '')
      const result = validateFileUpload(file, config, prodEnv)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('MIME type is required')
    })

    it('should reject file with missing MIME type in production', () => {
      const file = new MockFile('document.pdf', 1024 * 1024, '')
      
      const result = validateFileUpload(file, config, prodEnv)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('MIME type is required')
    })

    it('should allow file with empty MIME type in development (with warning)', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const file = new MockFile('document.pdf', 1024 * 1024, '')
      const result = validateFileUpload(file, config, devEnv)

      expect(result.valid).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalled()
      const warnCall = consoleWarnSpy.mock.calls[0]
      expect(warnCall[0]).toContain('SECURITY WARNING')
      expect(warnCall[0]).toContain('missing/empty MIME type')

      consoleWarnSpy.mockRestore()
    })

    it('should allow file with application/octet-stream in development', () => {
      const file = new MockFile('unknown.bin', 1024 * 1024, 'application/octet-stream')
      const result = validateFileUpload(file, config, devEnv)

      // application/octet-stream is in the default allowed list
      expect(result.valid).toBe(true)
    })
  })

  describe('File size validation', () => {
    it('should reject file exceeding max size', () => {
      const maxSize = config.maxFileSize
      const file = new MockFile('large.pdf', maxSize + 1, 'application/pdf')
      const result = validateFileUpload(file, config, devEnv)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds maximum allowed size')
    })

    it('should accept file within size limit', () => {
      const maxSize = config.maxFileSize
      const file = new MockFile('small.pdf', maxSize - 1, 'application/pdf')
      const result = validateFileUpload(file, config, devEnv)

      expect(result.valid).toBe(true)
    })
  })

  describe('Dangerous file extensions', () => {
    it('should reject files with dangerous extensions', () => {
      // Files with dangerous extensions should be rejected
      // Note: application/x-msdownload is in allowed list, but .exe extension makes it dangerous
      const dangerousFiles = [
        new MockFile('script.exe', 1024, 'application/x-msdownload'), // Allowed MIME but dangerous ext
        new MockFile('script.bat', 1024, 'text/plain'), // text/plain allowed but .bat dangerous
        new MockFile('script.cmd', 1024, 'text/plain'), // text/plain allowed but .cmd dangerous
        new MockFile('script.js', 1024, 'application/javascript'), // Not in allowed list
        new MockFile('script.sh', 1024, 'text/plain'), // text/plain allowed but .sh dangerous
      ]

      dangerousFiles.forEach(file => {
        const result = validateFileUpload(file, config, prodEnv)
        expect(result.valid).toBe(false)
        // Should either reject for MIME type or for security reasons
        expect(result.error).toBeDefined()
        expect(result.error).toMatch(/not allowed|security reasons/)
      })
    })

    it('should warn about dangerous extensions with allowed MIME type in development', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // File with dangerous extension but allowed MIME type (application/octet-stream is allowed)
      const file = new MockFile('script.exe', 1024, 'application/octet-stream')
      const result = validateFileUpload(file, config, devEnv)

      // In development, should warn but might allow
      // The file has application/octet-stream which is in allowed list, but .exe is dangerous
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('SECURITY WARNING')
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('dangerous extension')

      consoleWarnSpy.mockRestore()
    })
  })

  describe('File extension validation', () => {
    it('should validate file extension as secondary check', () => {
      // File with .pdf extension but wrong MIME type
      const file = new MockFile('document.pdf', 1024, 'text/plain')
      const result = validateFileUpload(file, config, devEnv)

      // text/plain is allowed, so it should pass
      expect(result.valid).toBe(true)
    })

    it('should handle files without extensions', () => {
      const file = new MockFile('document', 1024, 'application/pdf')
      const result = validateFileUpload(file, config, devEnv)

      expect(result.valid).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should handle zero-byte files', () => {
      const file = new MockFile('empty.pdf', 0, 'application/pdf')
      const result = validateFileUpload(file, config, devEnv)

      expect(result.valid).toBe(true)
    })

    it('should handle files with very long names', () => {
      const longName = 'a'.repeat(255) + '.pdf'
      const file = new MockFile(longName, 1024, 'application/pdf')
      const result = validateFileUpload(file, config, devEnv)

      expect(result.valid).toBe(true)
    })

    it('should handle files with special characters in names', () => {
      const file = new MockFile('document (1).pdf', 1024, 'application/pdf')
      const result = validateFileUpload(file, config, devEnv)

      expect(result.valid).toBe(true)
    })
  })
})

