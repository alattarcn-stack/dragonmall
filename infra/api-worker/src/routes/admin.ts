import { Hono } from 'hono'
import type { Env } from '../types'
import { ProductService, OrderService, InventoryService, SupportService, PaymentService, UserService, CategoryService, CouponService } from '@dragon/core'
import { adminAuth } from '../middleware/auth'
import { ProductCreateSchema, ProductUpdateSchema, InventoryAddSchema, SupportTicketReplySchema, CategoryCreateSchema, CategoryUpdateSchema, CouponCreateSchema, CouponUpdateSchema, formatValidationError } from '../validation/schemas'
import { getFileUploadConfig, validateFileUpload } from '../utils/file-upload'
import { sendSupportReplyEmail } from '../utils/email'
import { logError, logInfo } from '../utils/logging'
import { parsePaginationParams, getOffset, createPaginatedResponse } from '../utils/pagination'
import { makeError, ErrorCodes } from '../utils/errors'
import { logOrderRefund, logOrderStatusChange } from '../utils/audit-log'

export function createAdminRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()

  // All admin routes require authentication
  router.use('/*', adminAuth)

  const productService = new ProductService(env.D1_DATABASE)
  const orderService = new OrderService(env.D1_DATABASE)
  const inventoryService = new InventoryService(env.D1_DATABASE)
  const supportService = new SupportService(env.D1_DATABASE)
  const paymentService = new PaymentService(env.D1_DATABASE)
  const userService = new UserService(env.D1_DATABASE)
  const categoryService = new CategoryService(env.D1_DATABASE)
  const couponService = new CouponService(env.D1_DATABASE)

  // Dashboard stats
  router.get('/dashboard', async (c) => {
    try {
      const now = Math.floor(Date.now() / 1000)
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60

      // Total revenue last 30 days (from paid payments)
      const revenueResult = await env.D1_DATABASE
        .prepare(`
          SELECT COALESCE(SUM(p.amount), 0) as total
          FROM payments p
          INNER JOIN orders o ON p.order_id = o.id
          WHERE p.status = 'paid'
            AND o.status NOT IN ('cancelled', 'refunded')
            AND p.paid_at >= ?
        `)
        .bind(thirtyDaysAgo)
        .first<{ total: number }>()

      const totalRevenueLast30Days = revenueResult?.total || 0

      // Orders last 30 days (not cancelled/refunded)
      const ordersResult = await env.D1_DATABASE
        .prepare(`
          SELECT COUNT(DISTINCT o.id) as count
          FROM orders o
          INNER JOIN payments p ON o.id = p.order_id
          WHERE o.status NOT IN ('cancelled', 'refunded', 'cart')
            AND p.status = 'paid'
            AND o.created_at >= ?
        `)
        .bind(thirtyDaysAgo)
        .first<{ count: number }>()

      const ordersLast30Days = ordersResult?.count || 0

      // Total customers (users with role='customer')
      const customersResult = await env.D1_DATABASE
        .prepare(`
          SELECT COUNT(*) as count
          FROM users
          WHERE role = 'customer' AND is_active = 1
        `)
        .first<{ count: number }>()

      const totalCustomers = customersResult?.count || 0

      // Revenue by day (last 30 days)
      const revenueByDayResult = await env.D1_DATABASE
        .prepare(`
          SELECT 
            DATE(p.paid_at, 'unixepoch') as date,
            COALESCE(SUM(p.amount), 0) as total
          FROM payments p
          INNER JOIN orders o ON p.order_id = o.id
          WHERE p.status = 'paid'
            AND o.status NOT IN ('cancelled', 'refunded')
            AND p.paid_at >= ?
          GROUP BY DATE(p.paid_at, 'unixepoch')
          ORDER BY date ASC
        `)
        .bind(thirtyDaysAgo)
        .all<{ date: string; total: number }>()

      // Fill in missing days with 0
      const revenueByDayMap = new Map<string, number>()
      revenueByDayResult.results?.forEach((row) => {
        revenueByDayMap.set(row.date, row.total)
      })

      const revenueByDay: Array<{ date: string; total: number }> = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now * 1000 - i * 24 * 60 * 60)
        const dateStr = date.toISOString().split('T')[0]
        revenueByDay.push({
          date: dateStr,
          total: revenueByDayMap.get(dateStr) || 0,
        })
      }

      // Top products (last 30 days)
      const topProductsResult = await env.D1_DATABASE
        .prepare(`
          SELECT 
            oi.product_id as productId,
            pr.name,
            COALESCE(SUM(p.amount), 0) as totalRevenue,
            SUM(oi.quantity) as quantitySold
          FROM order_items oi
          INNER JOIN orders o ON oi.order_id = o.id
          INNER JOIN payments p ON o.id = p.order_id
          INNER JOIN products pr ON oi.product_id = pr.id
          WHERE p.status = 'paid'
            AND o.status NOT IN ('cancelled', 'refunded', 'cart')
            AND p.paid_at >= ?
          GROUP BY oi.product_id, pr.name
          ORDER BY totalRevenue DESC
          LIMIT 5
        `)
        .bind(thirtyDaysAgo)
        .all<{
          productId: number
          name: string
          totalRevenue: number
          quantitySold: number
        }>()

      const topProducts = (topProductsResult.results || []).map((row) => ({
        productId: row.productId,
        name: row.name,
        totalRevenue: row.totalRevenue,
        quantitySold: row.quantitySold,
      }))

      // Get recent orders (last 10, not cancelled/refunded)
      const recentOrdersResult = await env.D1_DATABASE
        .prepare(`
          SELECT o.*
          FROM orders o
          INNER JOIN payments p ON o.id = p.order_id
          WHERE o.status NOT IN ('cancelled', 'refunded', 'cart')
            AND p.status = 'paid'
          ORDER BY o.created_at DESC
          LIMIT 10
        `)
        .all()

      const recentOrders = recentOrdersResult.results || []

      // Total products count
      const products = await productService.listProducts()
      const totalProducts = products.length

      // Total users count
      const users = await userService.getAll()
      const totalUsers = users.length

      logInfo('Dashboard stats fetched', {
        totalRevenueLast30Days,
        ordersLast30Days,
        totalCustomers,
      }, env)

      return c.json({
        data: {
          totalRevenueLast30Days,
          ordersLast30Days,
          totalCustomers,
          revenueByDay,
          topProducts,
          recentOrders,
          totalProducts,
          totalUsers,
        },
      })
    } catch (error: any) {
      logError('Error fetching dashboard stats', { error: error.message }, env)
      return c.json({ error: 'Failed to fetch dashboard stats' }, 500)
    }
  })

  // Products CRUD
  router.get('/products', async (c) => {
    try {
      // Parse pagination parameters
      const { page, pageSize } = parsePaginationParams(
        c.req.query('page'),
        c.req.query('pageSize'),
        100 // Max 100 products per page
      )
      const offset = getOffset(page, pageSize)

      // Get total count
      const countResult = await env.D1_DATABASE
        .prepare('SELECT COUNT(*) as total FROM products')
        .first<{ total: number }>()
      const total = countResult?.total || 0

      // Get paginated products
      const products = await productService.listProducts({
        limit: pageSize,
        offset,
      })

      return c.json(createPaginatedResponse(products, page, pageSize, total))
    } catch (error: any) {
      console.error('Error fetching products:', error)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch products'), 500)
    }
  })

  router.get('/products/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      const product = await productService.getById(id)
      if (!product) {
        return c.json({ error: 'Product not found' }, 404)
      }
      return c.json({ data: product })
    } catch (error: any) {
      return c.json({ error: 'Failed to fetch product' }, 500)
    }
  })

  router.post('/products', async (c) => {
    try {
      const body = await c.req.json()

      // Validate input
      const validationResult = ProductCreateSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const validatedBody = validationResult.data
      const product = await productService.create({
        name: validatedBody.name,
        description: validatedBody.description || null,
        images: validatedBody.images || null,
        price: validatedBody.price,
        stock: validatedBody.stock ?? null,
        categoryId: validatedBody.categoryId,
        isActive: validatedBody.isActive ? 1 : 0,
        minQuantity: validatedBody.minQuantity,
        maxQuantity: validatedBody.maxQuantity ?? null,
        productType: validatedBody.productType,
        sortOrder: validatedBody.sortOrder,
      })
      return c.json({ data: product })
    } catch (error: any) {
      console.error('Error creating product:', error)
      return c.json({ error: 'Failed to create product', message: error.message }, 500)
    }
  })

  router.put('/products/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      const body = await c.req.json()

      // Validate input
      const validationResult = ProductUpdateSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const validatedBody = validationResult.data
      const product = await productService.update(id, {
        name: validatedBody.name,
        description: validatedBody.description,
        images: validatedBody.images,
        price: validatedBody.price,
        stock: validatedBody.stock,
        categoryId: validatedBody.categoryId,
        isActive: validatedBody.isActive ? 1 : 0,
        minQuantity: validatedBody.minQuantity,
        maxQuantity: validatedBody.maxQuantity,
        productType: validatedBody.productType,
        sortOrder: validatedBody.sortOrder,
      })
      return c.json({ data: product })
    } catch (error: any) {
      console.error('Error updating product:', error)
      return c.json({ error: 'Failed to update product', message: error.message }, 500)
    }
  })

  router.delete('/products/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      await productService.delete(id)
      return c.json({ data: { message: 'Product deleted' } })
    } catch (error: any) {
      console.error('Error deleting product:', error)
      return c.json({ error: 'Failed to delete product', message: error.message }, 500)
    }
  })

  // Upload product file
  router.post('/products/:id/files', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      const formData = await c.req.formData()
      const file = formData.get('file') as File

      if (!file) {
        return c.json({ error: 'No file provided' }, 400)
      }

      // Validate file upload
      const config = getFileUploadConfig(env)
      const validation = validateFileUpload(file, config, env)
      
      if (!validation.valid) {
        return c.json({ 
          error: 'FILE_VALIDATION_ERROR',
          message: validation.error 
        }, 400)
      }

      // Upload to R2
      const fileKey = `products/${id}/${Date.now()}-${file.name}`
      await env.R2_BUCKET.put(fileKey, file.stream(), {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
      })

      // Store file metadata in database
      const createdAt = Math.floor(Date.now() / 1000)
      await env.D1_DATABASE
        .prepare(
          'INSERT INTO product_files (product_id, r2_key, file_name, file_size, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(id, fileKey, file.name, file.size, file.type || 'application/octet-stream', createdAt)
        .run()

      return c.json({ 
        data: { 
          fileKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
        } 
      })
    } catch (error: any) {
      console.error('File upload error:', error)
      return c.json({ error: 'Failed to upload file' }, 500)
    }
  })

  // Orders
  router.get('/orders', async (c) => {
    try {
      // Parse pagination parameters
      const { page, pageSize } = parsePaginationParams(
        c.req.query('page'),
        c.req.query('pageSize'),
        100 // Max 100 orders per page
      )
      const offset = getOffset(page, pageSize)

      // Get total count
      const countResult = await env.D1_DATABASE
        .prepare('SELECT COUNT(*) as total FROM orders')
        .first<{ total: number }>()
      const total = countResult?.total || 0

      // Get paginated orders
      const ordersResult = await env.D1_DATABASE
        .prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .bind(pageSize, offset)
        .all()
      const orders = (ordersResult.results || []) as any[]

      return c.json(createPaginatedResponse(orders, page, pageSize, total))
    } catch (error: any) {
      console.error('Error fetching orders:', error)
      return c.json(makeErrorResponse(ErrorCodesResponse.INTERNAL_ERROR, 'Failed to fetch orders'), 500)
    }
  })

  router.get('/orders/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      const order = await orderService.getById(id)
      if (!order) {
        return c.json({ error: 'Order not found' }, 404)
      }

      // Get payment and refunds for this order
      const payment = await paymentService.getByOrderId(id)
      const refunds = payment ? await paymentService.getRefundsByPaymentId(payment.id) : []

      return c.json({
        data: {
          ...order,
          payment,
          refunds,
        },
      })
    } catch (error: any) {
      return c.json({ error: 'Failed to fetch order' }, 500)
    }
  })

  router.post('/orders/:id/refund', async (c) => {
    try {
      const orderId = parseInt(c.req.param('id'), 10)
      if (isNaN(orderId)) {
        return c.json({ error: 'Invalid order ID' }, 400)
      }

      // Get admin ID from context
      const adminId = c.get('userId')
      const requestId = c.get('requestId')

      const body = await c.req.json().catch(() => ({}))
      const reason = body.reason || null

      // Get order
      const order = await orderService.getById(orderId)
      if (!order) {
        return c.json({ error: 'Order not found' }, 404)
      }

      // Get old status for audit log
      const oldStatus = order.status

      // Validate order is paid/completed
      if (order.status !== 'completed' && order.status !== 'processing') {
        return c.json({ error: 'Order must be completed or processing to refund' }, 400)
      }

      // Get payment
      const payment = await paymentService.getByOrderId(orderId)
      if (!payment) {
        return c.json({ error: 'Payment not found for this order' }, 404)
      }

      // Check if already refunded
      if (payment.status === 'refunded') {
        return c.json({ error: 'Payment has already been refunded' }, 400)
      }

      // Check for existing successful refunds
      const existingRefunds = await paymentService.getRefundsByPaymentId(payment.id)
      const hasSuccessfulRefund = existingRefunds.some((r) => r.status === 'succeeded')
      if (hasSuccessfulRefund) {
        return c.json({ error: 'This payment has already been refunded' }, 400)
      }

      // Initialize Stripe/PayPal clients
      const Stripe = (await import('stripe')).default
      const paypal = await import('@paypal/checkout-server-sdk')

      let stripe: Stripe | null = null
      let paypalClient: paypal.core.PayPalHttpClient | null = null

      if (env.STRIPE_SECRET_KEY) {
        stripe = new Stripe(env.STRIPE_SECRET_KEY, {
          apiVersion: '2024-11-20.acacia',
        })
      }

      if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
        const environment =
          env.ENVIRONMENT === 'production'
            ? new paypal.core.LiveEnvironment(env.PAYPAL_CLIENT_ID, env.PAYPAL_CLIENT_SECRET)
            : new paypal.core.SandboxEnvironment(env.PAYPAL_CLIENT_ID, env.PAYPAL_CLIENT_SECRET)
        paypalClient = new paypal.core.PayPalHttpClient(environment)
      }

      // Process refund based on provider
      let providerRefundId: string | null = null
      let refundStatus: 'pending' | 'succeeded' | 'failed' = 'pending'

      try {
        if (payment.method === 'stripe' && payment.externalTransactionId && stripe) {
          // Stripe refund
          const refundAmount = order.totalAmount ?? order.amount
          const stripeRefund = await stripe.refunds.create({
            payment_intent: payment.externalTransactionId,
            amount: refundAmount,
            reason: reason ? 'requested_by_customer' : undefined,
          })

          providerRefundId = stripeRefund.id
          refundStatus = stripeRefund.status === 'succeeded' ? 'succeeded' : 'pending'
        } else if (payment.method === 'paypal' && payment.externalTransactionId && paypalClient) {
          // PayPal refund
          // For PayPal, we need to get the capture ID from the order
          // This is a simplified version - in production, you'd need to track capture IDs
          // For now, we'll try to refund using the order ID
          const request = new paypal.payments.CapturesRefundRequest(payment.externalTransactionId)
          request.prefer('return=representation')
          request.requestBody({
            amount: {
              currency_code: payment.currency.toUpperCase(),
              value: ((order.totalAmount ?? order.amount) / 100).toFixed(2),
            },
            note_to_payer: reason || undefined,
          })

          const refundResponse = await paypalClient.execute(request)
          providerRefundId = refundResponse.result.id
          refundStatus = refundResponse.result.status === 'COMPLETED' ? 'succeeded' : 'pending'
        } else {
          return c.json({ error: 'Payment provider not configured or invalid payment method' }, 400)
        }

        // Create refund record
        const refundAmount = order.totalAmount ?? order.amount
        const refund = await paymentService.createRefundRecord(
          payment.id,
          orderId,
          refundAmount,
          payment.currency,
          payment.method,
          providerRefundId,
          refundStatus,
          reason
        )

        // Update payment status
        if (refundStatus === 'succeeded') {
          await paymentService.updatePaymentStatus(payment.transactionNumber, 'refunded')
        }

        // Mark order as refunded and disable downloads
        if (refundStatus === 'succeeded') {
          const refundedOrder = await orderService.markOrderRefunded(orderId)
          
          // Audit log: Order refunded
          logOrderRefund(
            orderId,
            refund.id,
            refundAmount,
            reason,
            adminId || null,
            requestId,
            env
          )
          
          // Audit log: Order status change
          logOrderStatusChange(
            orderId,
            oldStatus,
            refundedOrder.status,
            adminId || null,
            'admin',
            requestId,
            env
          )
        }

        // Get updated order and payment
        const updatedOrder = await orderService.getById(orderId)
        const updatedPayment = await paymentService.getById(payment.id)

        logInfo('Order refunded', { orderId, paymentId: payment.id, refundId: refund.id }, env)

        return c.json({
          data: {
            refund,
            order: updatedOrder,
            payment: updatedPayment,
          },
        })
      } catch (refundError: any) {
        console.error('Refund processing error:', refundError)

        // Create a failed refund record
        const refundAmount = order.totalAmount ?? order.amount
        const refund = await paymentService.createRefundRecord(
          payment.id,
          orderId,
          refundAmount,
          payment.currency,
          payment.method,
          null,
          'failed',
          reason || refundError.message
        )

        return c.json(
          {
            error: 'Failed to process refund',
            message: refundError.message || 'Refund processing failed',
            refund,
          },
          500
        )
      }
    } catch (error: any) {
      console.error('Error processing refund:', error)
      return c.json({ error: 'Failed to process refund', message: error.message }, 500)
    }
  })

  // Inventory
  router.get('/inventory', async (c) => {
    try {
      // Parse pagination parameters
      const { page, pageSize } = parsePaginationParams(
        c.req.query('page'),
        c.req.query('pageSize'),
        100 // Max 100 inventory items per page
      )
      const offset = getOffset(page, pageSize)

      const productId = c.req.query('productId')
      
      // Build count query
      let countQuery = 'SELECT COUNT(*) as total FROM inventory_items'
      const countBinds: unknown[] = []
      
      if (productId) {
        countQuery += ' WHERE product_id = ?'
        countBinds.push(parseInt(productId, 10))
      }
      
      // Get total count
      const countResult = await env.D1_DATABASE
        .prepare(countQuery)
        .bind(...countBinds)
        .first<{ total: number }>()
      const total = countResult?.total || 0

      // Build data query
      let query = 'SELECT * FROM inventory_items'
      const binds: unknown[] = []
      
      if (productId) {
        query += ' WHERE product_id = ?'
        binds.push(parseInt(productId, 10))
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
      binds.push(pageSize, offset)
      
      const result = await env.D1_DATABASE
        .prepare(query)
        .bind(...binds)
        .all()
      
      return c.json(createPaginatedResponse(result.results || [], page, pageSize, total))
    } catch (error: any) {
      console.error('Error fetching inventory:', error)
      return c.json(makeErrorResponse(ErrorCodesResponse.INTERNAL_ERROR, 'Failed to fetch inventory'), 500)
    }
  })

  router.post('/inventory', async (c) => {
    try {
      const body = await c.req.json()

      // Validate input
      const validationResult = InventoryAddSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { productId, items } = validationResult.data
      await inventoryService.addItems(productId, items)

      return c.json({ data: { added: items.length } })
    } catch (error: any) {
      return c.json({ error: 'Failed to add inventory items' }, 500)
    }
  })

  // Support tickets
  router.get('/support', async (c) => {
    try {
      // Parse pagination parameters
      const { page, pageSize } = parsePaginationParams(
        c.req.query('page'),
        c.req.query('pageSize'),
        100 // Max 100 tickets per page
      )
      const offset = getOffset(page, pageSize)

      // Get total count
      const countResult = await env.D1_DATABASE
        .prepare('SELECT COUNT(*) as total FROM support_tickets')
        .first<{ total: number }>()
      const total = countResult?.total || 0

      // Get paginated tickets
      const tickets = await supportService.getAll({
        limit: pageSize,
        offset,
      })

      return c.json(createPaginatedResponse(tickets, page, pageSize, total))
    } catch (error: any) {
      console.error('Error fetching tickets:', error)
      return c.json(makeErrorResponse(ErrorCodesResponse.INTERNAL_ERROR, 'Failed to fetch tickets'), 500)
    }
  })

  router.get('/support/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      const ticket = await supportService.getById(id)
      if (!ticket) {
        return c.json({ error: 'Ticket not found' }, 404)
      }
      return c.json({ data: ticket })
    } catch (error: any) {
      return c.json({ error: 'Failed to fetch ticket' }, 500)
    }
  })

  router.post('/support/:id/reply', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      const body = await c.req.json()

      // Validate input
      const validationResult = SupportTicketReplySchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { reply } = validationResult.data

      // Get ticket before replying
      const ticket = await supportService.getById(id)
      if (!ticket) {
        return c.json({ error: 'Support ticket not found' }, 404)
      }

      // Reply to ticket
      await supportService.reply(id, reply)

      // Get user email to send notification
      const user = await userService.getById(ticket.userId)
      if (user && user.email) {
        try {
          await sendSupportReplyEmail(
            user.email,
            {
              id: ticket.id,
              content: ticket.content,
              reply,
            },
            env
          )
          logInfo('Support reply email sent', { ticketId: id, userId: user.id }, env)
        } catch (emailError) {
          logError('Failed to send support reply email', emailError, { ticketId: id, userId: user.id }, env)
          // Don't fail the request if email fails
        }
      }

      const updatedTicket = await supportService.getById(id)
      return c.json({ data: updatedTicket })
    } catch (error: any) {
      return c.json({ error: 'Failed to reply to ticket' }, 500)
    }
  })

  // Categories CRUD
  router.get('/categories', async (c) => {
    try {
      // Parse pagination parameters
      const { page, pageSize } = parsePaginationParams(
        c.req.query('page'),
        c.req.query('pageSize'),
        100 // Max 100 categories per page
      )
      const offset = getOffset(page, pageSize)

      const includeInactive = c.req.query('includeInactive') === 'true'
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM categories'
      if (!includeInactive) {
        countQuery += ' WHERE is_active = 1'
      }
      const countResult = await env.D1_DATABASE
        .prepare(countQuery)
        .first<{ total: number }>()
      const total = countResult?.total || 0

      // Get all categories (categories list is typically small, but we'll still paginate)
      const allCategories = await categoryService.listCategories({ includeInactive })
      
      // Apply pagination manually since listCategories doesn't support it
      const categories = allCategories.slice(offset, offset + pageSize)

      return c.json(createPaginatedResponse(categories, page, pageSize, total))
    } catch (error: any) {
      console.error('Error fetching categories:', error)
      return c.json(makeErrorResponse(ErrorCodesResponse.INTERNAL_ERROR, 'Failed to fetch categories'), 500)
    }
  })

  router.get('/categories/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      if (isNaN(id)) {
        return c.json({ error: 'Invalid category ID' }, 400)
      }

      const category = await categoryService.getCategoryById(id)
      if (!category) {
        return c.json({ error: 'Category not found' }, 404)
      }

      return c.json({ data: category })
    } catch (error: any) {
      console.error('Error fetching category:', error)
      return c.json({ error: 'Failed to fetch category' }, 500)
    }
  })

  router.post('/categories', async (c) => {
    try {
      const body = await c.req.json()

      const validationResult = CategoryCreateSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const input = validationResult.data

      // Check if slug already exists
      const existing = await categoryService.getCategoryBySlug(input.slug)
      if (existing) {
        return c.json({ error: 'Category with this slug already exists' }, 400)
      }

      const category = await categoryService.createCategory({
        name: input.name,
        slug: input.slug,
        description: input.description,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      })

      return c.json({ data: category }, 201)
    } catch (error: any) {
      console.error('Error creating category:', error)
      return c.json({ error: 'Failed to create category', message: error.message }, 500)
    }
  })

  router.put('/categories/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      if (isNaN(id)) {
        return c.json({ error: 'Invalid category ID' }, 400)
      }

      const body = await c.req.json()

      const validationResult = CategoryUpdateSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const input = validationResult.data

      // If slug is being updated, check if it already exists
      if (input.slug) {
        const existing = await categoryService.getCategoryBySlug(input.slug)
        if (existing && existing.id !== id) {
          return c.json({ error: 'Category with this slug already exists' }, 400)
        }
      }

      const category = await categoryService.updateCategory(id, {
        name: input.name,
        slug: input.slug,
        description: input.description,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      })

      return c.json({ data: category })
    } catch (error: any) {
      console.error('Error updating category:', error)
      if (error.message === 'Category not found') {
        return c.json({ error: 'Category not found' }, 404)
      }
      return c.json({ error: 'Failed to update category', message: error.message }, 500)
    }
  })

  router.delete('/categories/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      if (isNaN(id)) {
        return c.json({ error: 'Invalid category ID' }, 400)
      }

      await categoryService.deleteCategory(id)

      return c.json({ data: { message: 'Category deleted successfully' } })
    } catch (error: any) {
      console.error('Error deleting category:', error)
      if (error.message === 'Category not found') {
        return c.json({ error: 'Category not found' }, 404)
      }
      if (error.message.includes('product(s) are using this category')) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Failed to delete category', message: error.message }, 500)
    }
  })

  return router
}

