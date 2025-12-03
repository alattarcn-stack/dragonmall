import type { Env } from '../types'
import { logError, logInfo } from './logging'
import { escapeHtml } from './sanitize'

/**
 * Email Provider Interface
 * Abstract interface for email providers to allow easy swapping
 */
interface EmailProvider {
  sendEmail(params: {
    to: string
    from: string
    subject: string
    html: string
    text?: string
  }): Promise<void>
}

/**
 * Resend Email Provider Implementation
 * Uses Resend API (https://resend.com)
 */
class ResendProvider implements EmailProvider {
  private apiKey: string
  private baseUrl = 'https://api.resend.com'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async sendEmail(params: {
    to: string
    from: string
    subject: string
    html: string
    text?: string
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text || this.htmlToText(params.html),
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Resend API error: ${response.status} ${error}`)
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion (remove tags, decode entities)
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }
}

/**
 * SendGrid Email Provider Implementation
 * Uses SendGrid API (https://sendgrid.com)
 */
class SendGridProvider implements EmailProvider {
  private apiKey: string
  private baseUrl = 'https://api.sendgrid.com/v3'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async sendEmail(params: {
    to: string
    from: string
    subject: string
    html: string
    text?: string
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/mail/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: params.to }],
          },
        ],
        from: { email: params.from },
        subject: params.subject,
        content: [
          {
            type: 'text/plain',
            value: params.text || this.htmlToText(params.html),
          },
          {
            type: 'text/html',
            value: params.html,
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SendGrid API error: ${response.status} ${error}`)
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }
}

/**
 * Get email provider based on environment configuration
 */
function getEmailProvider(env: Env): EmailProvider | null {
  const provider = env.EMAIL_PROVIDER?.toLowerCase()
  const apiKey = env.EMAIL_API_KEY

  if (!apiKey) {
    return null
  }

  switch (provider) {
    case 'resend':
      return new ResendProvider(apiKey)
    case 'sendgrid':
      return new SendGridProvider(apiKey)
    default:
      // Default to Resend if provider not specified
      return new ResendProvider(apiKey)
  }
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(
  to: string,
  order: {
    id: number
    orderNumber?: string
    products: Array<{ name: string; quantity: number }>
    amount: number
    downloadLinks?: Array<{ productName: string; url: string; expiresAt?: number }>
  },
  env: Env
): Promise<void> {
  const provider = getEmailProvider(env)
  if (!provider) {
    logError('Email provider not configured, cannot send order confirmation', null, { to, orderId: order.id }, env)
    return
  }

  const from = env.EMAIL_FROM || 'noreply@example.com'
  const frontendUrl = env.FRONTEND_URL || env.FRONTEND_BASE_URL || 'http://localhost:3000'

  const orderNumber = order.orderNumber || `#${order.id}`
  const amount = (order.amount / 100).toFixed(2) // Convert cents to dollars

  let downloadSection = ''
  if (order.downloadLinks && order.downloadLinks.length > 0) {
    downloadSection = `
      <h3>Download Links</h3>
      <ul>
        ${order.downloadLinks.map(link => `
          <li>
            <strong>${link.productName}</strong><br>
            <a href="${link.url}">Download</a>
            ${link.expiresAt ? `<br><small>Expires: ${new Date(link.expiresAt * 1000).toLocaleString()}</small>` : ''}
          </li>
        `).join('')}
      </ul>
    `
  } else {
    downloadSection = `
      <p>Your order is being processed. You will receive download links via email once your order is fulfilled.</p>
    `
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .order-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmation</h1>
          </div>
          <div class="content">
            <p>Thank you for your order!</p>
            
            <div class="order-details">
              <h2>Order ${orderNumber}</h2>
              <p><strong>Total:</strong> $${amount}</p>
              
              <h3>Products</h3>
              <ul>
                ${order.products.map(p => `<li>${p.name} (Quantity: ${p.quantity})</li>`).join('')}
              </ul>
            </div>

            ${downloadSection}

            <p>
              <a href="${frontendUrl}/account/orders" class="button">View Order History</a>
            </p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    await provider.sendEmail({
      to,
      from,
      subject: `Order Confirmation - ${orderNumber}`,
      html,
    })
    logInfo('Order confirmation email sent', { to, orderId: order.id }, env)
  } catch (error) {
    logError('Failed to send order confirmation email', error, { to, orderId: order.id }, env)
    throw error
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  env: Env
): Promise<void> {
  const provider = getEmailProvider(env)
  if (!provider) {
    logError('Email provider not configured, cannot send password reset email', null, { to }, env)
    return
  }

  const from = env.EMAIL_FROM || 'noreply@example.com'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4F46E5;">${resetLink}</p>

            <div class="warning">
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    await provider.sendEmail({
      to,
      from,
      subject: 'Reset Your Password',
      html,
    })
    logInfo('Password reset email sent', { to }, env)
  } catch (error) {
    logError('Failed to send password reset email', error, { to }, env)
    throw error
  }
}

/**
 * Send support ticket reply email
 */
export async function sendSupportReplyEmail(
  to: string,
  ticket: {
    id: number
    content: string
    reply: string
  },
  env: Env
): Promise<void> {
  const provider = getEmailProvider(env)
  if (!provider) {
    logError('Email provider not configured, cannot send support reply email', null, { to, ticketId: ticket.id }, env)
    return
  }

  const from = env.EMAIL_FROM || 'support@example.com'
  const frontendUrl = env.FRONTEND_URL || env.FRONTEND_BASE_URL || 'http://localhost:3000'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .ticket-content { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #E5E7EB; }
          .reply-content { background-color: #EEF2FF; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Support Ticket Reply</h1>
          </div>
          <div class="content">
            <p>We've replied to your support ticket #${ticket.id}.</p>
            
            <div class="ticket-content">
              <h3>Your Original Message:</h3>
              <p>${escapeHtml(ticket.content).replace(/\n/g, '<br>')}</p>
            </div>

            <div class="reply-content">
              <h3>Our Reply:</h3>
              <p>${escapeHtml(ticket.reply).replace(/\n/g, '<br>')}</p>
            </div>

            <p>
              <a href="${frontendUrl}/account/support">View Ticket</a>
            </p>
          </div>
          <div class="footer">
            <p>If you have any further questions, please reply to this ticket.</p>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    await provider.sendEmail({
      to,
      from,
      subject: `Re: Support Ticket #${ticket.id}`,
      html,
    })
    logInfo('Support reply email sent', { to, ticketId: ticket.id }, env)
  } catch (error) {
    logError('Failed to send support reply email', error, { to, ticketId: ticket.id }, env)
    throw error
  }
}

