/**
 * XSS Protection Utilities
 * 
 * Provides functions to sanitize user-generated content to prevent XSS attacks.
 * 
 * Strategy:
 * - User-generated content (support tickets, etc.): Strip all HTML and escape
 * - Admin-generated content (product descriptions, etc.): Sanitize HTML with whitelist
 */

/**
 * Allowed HTML tags for admin-generated content (product descriptions, etc.)
 * Only safe, formatting tags are allowed
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', // Links are allowed but href will be sanitized
  'span', 'div',
]

/**
 * Allowed attributes per tag
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  span: ['class'],
  div: ['class'],
  code: ['class'],
  pre: ['class'],
}

/**
 * Escape HTML special characters
 * Converts <, >, &, ", ' to their HTML entity equivalents
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  
  return text.replace(/[&<>"'/]/g, (char) => map[char] || char)
}

/**
 * Sanitize URL to prevent javascript: and data: protocols
 */
function sanitizeUrl(url: string): string {
  // Remove whitespace
  url = url.trim()
  
  // Convert to lowercase for protocol check
  const lowerUrl = url.toLowerCase()
  
  // Block dangerous protocols
  if (lowerUrl.startsWith('javascript:') ||
      lowerUrl.startsWith('data:') ||
      lowerUrl.startsWith('vbscript:') ||
      lowerUrl.startsWith('file:') ||
      lowerUrl.startsWith('about:')) {
    return '#'
  }
  
  // Allow http, https, mailto, tel, and relative URLs
  if (lowerUrl.startsWith('http://') ||
      lowerUrl.startsWith('https://') ||
      lowerUrl.startsWith('mailto:') ||
      lowerUrl.startsWith('tel:') ||
      lowerUrl.startsWith('/') ||
      lowerUrl.startsWith('#')) {
    return url
  }
  
  // If no protocol, assume relative URL
  if (!lowerUrl.includes('://')) {
    return url
  }
  
  // Block unknown protocols
  return '#'
}

/**
 * Sanitize HTML attribute value
 */
function sanitizeAttribute(tag: string, attr: string, value: string): string {
  // Special handling for href/src attributes
  if (attr === 'href' || attr === 'src') {
    return sanitizeUrl(value)
  }
  
  // For other attributes, escape HTML
  return escapeHtml(value)
}

/**
 * Sanitize HTML content with a whitelist of allowed tags and attributes
 * 
 * This is a basic HTML sanitizer. For production use with complex HTML,
 * consider using a library like DOMPurify (if available for Cloudflare Workers).
 * 
 * @param html - HTML string to sanitize
 * @param allowedTags - Array of allowed HTML tag names (default: safe formatting tags)
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(
  html: string,
  allowedTags: string[] = ALLOWED_TAGS
): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  // Simple regex-based sanitizer
  // This is a basic implementation. For production, consider a more robust solution.
  
  // Remove script, style, iframe, object, embed tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
  html = html.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
  html = html.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
  html = html.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
  html = html.replace(/<input\b[^>]*>/gi, '')
  html = html.replace(/<button\b[^>]*>.*?<\/button>/gi, '')
  
  // Remove event handlers (onclick, onerror, etc.)
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
  html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
  
  // Process tags
  html = html.replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, closing, tagName, attributes) => {
    const lowerTag = tagName.toLowerCase()
    
    // If tag is not in whitelist, remove it
    if (!allowedTags.includes(lowerTag)) {
      return closing ? '' : '' // Remove opening/closing tags
    }
    
    // If closing tag, return as-is (already checked)
    if (closing) {
      return `</${lowerTag}>`
    }
    
    // Process attributes for opening tags
    const allowedAttrs = ALLOWED_ATTRIBUTES[lowerTag] || []
    const attrPattern = /(\w+)\s*=\s*(["'])(.*?)\2/gi
    const sanitizedAttrs: string[] = []
    
    let attrMatch
    while ((attrMatch = attrPattern.exec(attributes)) !== null) {
      const attrName = attrMatch[1].toLowerCase()
      const quote = attrMatch[2]
      const attrValue = attrMatch[3]
      
      // Only allow whitelisted attributes
      if (allowedAttrs.includes(attrName)) {
        const sanitizedValue = sanitizeAttribute(lowerTag, attrName, attrValue)
        sanitizedAttrs.push(`${attrName}=${quote}${sanitizedValue}${quote}`)
      }
    }
    
    const attrsStr = sanitizedAttrs.length > 0 ? ' ' + sanitizedAttrs.join(' ') : ''
    return `<${lowerTag}${attrsStr}>`
  })
  
  return html
}

/**
 * Sanitize user-generated content by stripping all HTML and escaping
 * Use this for support tickets, comments, and other user input
 * 
 * @param text - Text to sanitize
 * @returns Plain text with HTML escaped
 */
export function sanitizeUserContent(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }
  
  // Strip all HTML tags first
  let sanitized = text.replace(/<[^>]+>/g, '')
  
  // Escape remaining HTML entities
  sanitized = escapeHtml(sanitized)
  
  return sanitized
}

/**
 * Sanitize admin-generated content (product descriptions, category descriptions)
 * Allows safe HTML formatting but removes dangerous content
 * 
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeAdminContent(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }
  
  return sanitizeHtml(html, ALLOWED_TAGS)
}

/**
 * Sanitize a string based on content type
 * 
 * @param content - Content to sanitize
 * @param type - Type of content: 'user' (strip HTML) or 'admin' (sanitize HTML)
 * @returns Sanitized content
 */
export function sanitizeContent(content: string, type: 'user' | 'admin' = 'user'): string {
  if (type === 'admin') {
    return sanitizeAdminContent(content)
  }
  return sanitizeUserContent(content)
}

