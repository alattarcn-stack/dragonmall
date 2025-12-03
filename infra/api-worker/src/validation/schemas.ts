import { z } from 'zod'

// Auth schemas
export const AuthLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

export const AuthSignupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

// Order schemas
export const OrderCreateSchema = z.object({
  productId: z.number().int().positive('Product ID must be a positive integer'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  customerEmail: z.string().email('Invalid email format'),
  customerData: z.record(z.unknown()).optional(),
  userId: z.number().int().positive().optional(),
})

// Payment schemas
export const StripeCreateIntentSchema = z.object({
  orderId: z.number().int().positive('Order ID must be a positive integer'),
  currency: z.string().length(3, 'Currency must be a 3-letter code').optional().default('usd'),
})

export const PayPalCreateOrderSchema = z.object({
  orderId: z.number().int().positive('Order ID must be a positive integer'),
  currency: z.string().length(3, 'Currency must be a 3-letter code').optional().default('USD'),
})

// Support ticket schemas
export const SupportTicketCreateSchema = z.object({
  orderId: z.number().int().positive().optional(),
  content: z.string().min(1, 'Content is required').max(5000, 'Content is too long'),
})

export const SupportTicketReplySchema = z.object({
  reply: z.string().min(1, 'Reply is required').max(5000, 'Reply is too long'),
})

// Admin product schemas
export const ProductCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  description: z.string().max(5000, 'Description is too long').optional().nullable(),
  images: z.string().optional().nullable(),
  price: z.number().int().nonnegative('Price must be non-negative'),
  stock: z.number().int().nonnegative().optional().nullable(),
  categoryId: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  minQuantity: z.number().int().positive().default(1),
  maxQuantity: z.number().int().positive().optional().nullable(),
  productType: z.enum(['digital', 'license_code'], {
    errorMap: () => ({ message: 'Product type must be digital or license_code' }),
  }),
  sortOrder: z.number().int().nonnegative().default(10),
})

export const ProductUpdateSchema = ProductCreateSchema.partial()

// Inventory schemas
export const InventoryAddSchema = z.object({
  productId: z.number().int().positive('Product ID must be a positive integer'),
  items: z.array(z.object({
    licenseCode: z.string().min(1, 'License code is required'),
    password: z.string().optional(),
  })).min(1, 'At least one item is required'),
})

// Category schemas
export const CategoryCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase, URL-safe (letters, numbers, hyphens only)'),
  description: z.string().max(1000, 'Description is too long').optional().nullable(),
  sortOrder: z.number().int().nonnegative().default(10),
  isActive: z.boolean().default(true),
})

export const CategoryUpdateSchema = CategoryCreateSchema.partial()

// Product listing query params
export const ProductListQuerySchema = z.object({
  categoryId: z.string().regex(/^\d+$/).transform(Number).optional(),
  categorySlug: z.string().optional(),
  productType: z.enum(['digital', 'license_code']).optional(),
  query: z.string().min(1).max(200).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest']).default('relevance').optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
})

// Coupon schemas
export const CouponCreateSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50, 'Code is too long'),
  type: z.enum(['percentage', 'fixed'], {
    errorMap: () => ({ message: 'Type must be percentage or fixed' }),
  }),
  amount: z.number().int().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code').optional().nullable(),
  maxUses: z.number().int().nonnegative().optional().nullable(),
  perUserLimit: z.number().int().nonnegative().optional().nullable(),
  minOrderAmount: z.number().int().nonnegative().optional().nullable(),
  startsAt: z.number().int().nonnegative().optional().nullable(),
  endsAt: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const CouponUpdateSchema = CouponCreateSchema.partial()

export const ApplyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
})

// Cart schemas
export const AddCartItemSchema = z.object({
  productId: z.number().int().positive('Product ID must be a positive integer'),
  quantity: z.number().int().positive('Quantity must be a positive integer').default(1),
})

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be a positive integer'),
})

export const CartCheckoutSchema = z.object({
  customerEmail: z.string().email('Invalid email format').optional(),
})

// Validation error response helper
export interface ValidationError {
  error: 'VALIDATION_ERROR'
  details: Array<{
    field: string
    message: string
  }>
}

export function formatValidationError(error: z.ZodError): ValidationError {
  return {
    error: 'VALIDATION_ERROR',
    details: error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    })),
  }
}

