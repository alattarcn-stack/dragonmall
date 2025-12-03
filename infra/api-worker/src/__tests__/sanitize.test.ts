import { describe, it, expect } from 'vitest'
import { escapeHtml, sanitizeUserContent, sanitizeAdminContent, sanitizeContent } from '../utils/sanitize'

describe('XSS Sanitization', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;')
      expect(escapeHtml('Hello & World')).toBe('Hello &amp; World')
      expect(escapeHtml("It's a test")).toBe('It&#x27;s a test')
    })

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('should handle strings without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
    })
  })

  describe('sanitizeUserContent', () => {
    it('should strip all HTML tags and escape content', () => {
      const input = '<script>alert("XSS")</script>Hello <b>World</b>'
      const output = sanitizeUserContent(input)
      expect(output).toBe('alert(&quot;XSS&quot;)Hello World')
      expect(output).not.toContain('<script>')
      expect(output).not.toContain('<b>')
    })

    it('should escape HTML entities', () => {
      const input = 'Hello & <world>'
      const output = sanitizeUserContent(input)
      expect(output).toBe('Hello &amp; &lt;world&gt;')
    })

    it('should handle empty strings', () => {
      expect(sanitizeUserContent('')).toBe('')
    })

    it('should handle null/undefined', () => {
      expect(sanitizeUserContent(null as any)).toBe('')
      expect(sanitizeUserContent(undefined as any)).toBe('')
    })
  })

  describe('sanitizeAdminContent', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>'
      const output = sanitizeAdminContent(input)
      expect(output).toContain('<p>')
      expect(output).toContain('<strong>')
      expect(output).toContain('</strong>')
      expect(output).toContain('</p>')
    })

    it('should remove dangerous tags', () => {
      const input = '<script>alert("XSS")</script><p>Hello</p>'
      const output = sanitizeAdminContent(input)
      expect(output).not.toContain('<script>')
      expect(output).not.toContain('alert')
      expect(output).toContain('<p>Hello</p>')
    })

    it('should remove event handlers', () => {
      const input = '<p onclick="alert(\'XSS\')">Hello</p>'
      const output = sanitizeAdminContent(input)
      expect(output).not.toContain('onclick')
      expect(output).toContain('<p>')
      expect(output).toContain('Hello')
    })

    it('should sanitize URLs in links', () => {
      const input = '<a href="javascript:alert(\'XSS\')">Click</a>'
      const output = sanitizeAdminContent(input)
      expect(output).toContain('<a')
      expect(output).not.toContain('javascript:')
      expect(output).toContain('href="#')
    })

    it('should allow safe URLs', () => {
      const input = '<a href="https://example.com">Link</a>'
      const output = sanitizeAdminContent(input)
      expect(output).toContain('href="https://example.com"')
    })

    it('should remove style tags', () => {
      const input = '<style>body { color: red; }</style><p>Hello</p>'
      const output = sanitizeAdminContent(input)
      expect(output).not.toContain('<style>')
      expect(output).toContain('<p>Hello</p>')
    })

    it('should remove iframe tags', () => {
      const input = '<iframe src="evil.com"></iframe><p>Hello</p>'
      const output = sanitizeAdminContent(input)
      expect(output).not.toContain('<iframe>')
      expect(output).toContain('<p>Hello</p>')
    })

    it('should handle empty strings', () => {
      expect(sanitizeAdminContent('')).toBe('')
    })
  })

  describe('sanitizeContent', () => {
    it('should use user sanitization by default', () => {
      const input = '<script>alert("XSS")</script>'
      const output = sanitizeContent(input)
      expect(output).not.toContain('<script>')
    })

    it('should use admin sanitization when type is admin', () => {
      const input = '<p>Hello <strong>World</strong></p>'
      const output = sanitizeContent(input, 'admin')
      expect(output).toContain('<p>')
      expect(output).toContain('<strong>')
    })

    it('should use user sanitization when type is user', () => {
      const input = '<p>Hello</p>'
      const output = sanitizeContent(input, 'user')
      expect(output).not.toContain('<p>')
      expect(output).toContain('Hello')
    })
  })
})

