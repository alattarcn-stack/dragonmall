// Domain Types - Based on D1 schema
// IDs are numbers (INTEGER), timestamps are Unix timestamps (INTEGER)

export interface User {
  id: number
  email: string
  username?: string | null
  passwordHash: string
  role?: 'admin' | 'customer' // Default: 'admin'
  isActive: number // 0 = disabled, 1 = enabled
  createdAt: number // Unix timestamp
  lastLoginAt?: number | null // Unix timestamp
}

export interface Category {
  id: number
  name: string
  slug: string
  description?: string | null
  sortOrder: number
  isActive: number // 0 = inactive, 1 = active
  createdAt: number // Unix timestamp
  updatedAt: number // Unix timestamp
}

export interface Product {
  id: number
  name: string
  description?: string | null
  images?: string | null // JSON array string
  price: number // in cents
  stock?: number | null // null = unlimited
  categoryId: number
  isActive: number // 0 = inactive, 1 = active
  minQuantity: number
  maxQuantity?: number | null
  productType: 'digital' | 'license_code'
  sortOrder: number
  createdAt: number // Unix timestamp
}

export interface ProductFile {
  id: number
  productId: number
  r2Key: string
  fileName: string
  fileSize?: number | null
  mimeType?: string | null
  downloadCount: number
  maxDownloads?: number | null
  expiresAt?: number | null // Unix timestamp
  createdAt: number // Unix timestamp
}

export interface Coupon {
  id: number
  code: string // Stored in uppercase
  type: 'percentage' | 'fixed'
  amount: number // Percentage (0-100) or fixed amount in cents
  currency?: string | null // ISO 4217 code or NULL for "all"
  maxUses?: number | null // NULL = unlimited
  usedCount: number
  perUserLimit?: number | null // NULL = unlimited per user
  minOrderAmount?: number | null // Minimum order amount in cents, NULL = no minimum
  startsAt?: number | null // Unix timestamp, NULL = no start date
  endsAt?: number | null // Unix timestamp, NULL = no end date
  isActive: number // 0 = inactive, 1 = active
  createdAt: number // Unix timestamp
  updatedAt: number // Unix timestamp
}

export interface Order {
  id: number
  userId?: number | null
  customerEmail: string
  customerData?: string | null // JSON string
  quantity: number
  amount: number // in cents (kept for backward compatibility)
  couponCode?: string | null // Applied coupon code
  discountAmount: number // Discount amount in cents
  subtotalAmount?: number | null // Amount before discount in cents
  totalAmount?: number | null // Final amount after discount in cents
  status: 'cart' | 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded'
  fulfillmentResult?: string | null
  createdAt: number // Unix timestamp
  completedAt?: number | null // Unix timestamp
}

export interface Refund {
  id: number
  paymentId: number
  orderId: number
  amount: number // Refund amount in cents
  currency: string // ISO 4217 code
  provider: 'stripe' | 'paypal'
  providerRefundId?: string | null // External refund ID from provider
  status: 'pending' | 'succeeded' | 'failed'
  reason?: string | null // Optional refund reason
  createdAt: number // Unix timestamp
}

export interface OrderItem {
  id: number
  orderId: number
  productId: number
  quantity: number
  price: number // Price per unit in cents (snapshot)
}

export interface Payment {
  id: number
  transactionNumber: string // unique internal ID
  externalTransactionId?: string | null // Stripe PaymentIntent ID or PayPal Order ID
  userId?: number | null
  orderId?: number | null
  productId?: number | null
  amount: number // in cents (or smallest currency unit)
  currency: string // ISO 4217 currency code (usd, eur, gbp, etc.)
  method: 'stripe' | 'paypal'
  status: 'unpaid' | 'paid' | 'refunded' | 'failed'
  paymentMethodType?: string | null // card, apple_pay, google_pay, paypal, etc.
  metadata?: string | null // JSON string for additional payment data
  ipAddress?: string | null
  createdAt: number // Unix timestamp
  paidAt?: number | null // Unix timestamp
}

export interface InventoryItem {
  id: number
  productId: number
  licenseCode: string // Maps from license_code in DB
  password?: string | null
  orderId?: number | null // null = unused
  createdAt: number // Unix timestamp
  allocatedAt?: number | null // Unix timestamp
}

// Helper type for DB results (snake_case)
export interface InventoryItemDB {
  id: number
  product_id: number
  license_code: string
  password?: string | null
  order_id?: number | null
  created_at: number
  allocated_at?: number | null
}

export interface DownloadRecord {
  id: number
  orderId: number
  userId?: number | null
  productId: number
  productFileId?: number | null
  downloadUrl: string
  downloadCount: number
  maxDownloads?: number | null
  expiresAt?: number | null // Unix timestamp
  createdAt: number // Unix timestamp
  lastDownloadedAt?: number | null // Unix timestamp
}

export interface SupportTicket {
  id: number
  userId: number
  orderId?: number | null
  content: string
  reply?: string | null
  status: 'pending' | 'processing' | 'completed'
  createdAt: number // Unix timestamp
  repliedAt?: number | null // Unix timestamp
}

// Helper types for API requests/responses
export interface CreateOrderRequest {
  productId: number
  quantity: number
  customerEmail: string
  customerData?: Record<string, unknown>
  userId?: number
}

export interface CreatePaymentRequest {
  orderId: number
  method: 'stripe' | 'paypal'
  currency?: string // Default: 'usd'
  ipAddress?: string
}

export interface StripePaymentIntentResponse {
  clientSecret: string
  paymentId: number
  transactionNumber: string
}

export interface PayPalOrderResponse {
  orderId: string // PayPal order ID
  paymentId: number
  transactionNumber: string
  approvalUrl: string
}
