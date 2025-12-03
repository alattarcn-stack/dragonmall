// Cloudflare Workers Environment Types
export interface Env {
  D1_DATABASE: D1Database
  R2_BUCKET: R2Bucket
  KV_SESSIONS: KVNamespace
  QUEUE_WEBHOOKS: Queue
  ENVIRONMENT?: string
  FRONTEND_URL?: string // Storefront URL (e.g., https://store.example.com)
  ADMIN_URL?: string // Admin panel URL (e.g., https://admin.example.com)
  
  // Stripe
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_PUBLISHABLE_KEY?: string
  
  // PayPal
  PAYPAL_CLIENT_ID?: string
  PAYPAL_CLIENT_SECRET?: string
  
  // JWT
  JWT_SECRET?: string
  
  // File upload configuration
  MAX_FILE_SIZE?: string // in bytes, default: 100MB
  ALLOWED_FILE_TYPES?: string // comma-separated MIME types
  
  // Sentry
  SENTRY_DSN?: string // Sentry DSN for error tracking
  
  // Email
  EMAIL_PROVIDER?: string // 'resend' or 'sendgrid'
  EMAIL_API_KEY?: string // API key for email provider
  EMAIL_FROM?: string // From email address (e.g., noreply@example.com)
  FRONTEND_BASE_URL?: string // Base URL for frontend (used in email links)
  
  // Development seed (local dev only)
  SEED_SECRET?: string // Secret required to use admin seed endpoint (dev only)
}

