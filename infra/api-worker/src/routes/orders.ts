import { Hono } from 'hono'
import type { Env } from '../types'
import { OrderService, ProductService, InventoryService, DownloadService } from '@dragon/core'
import { OrderCreateSchema, formatValidationError } from '../validation/schemas'

export function createOrdersRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const orderService = new OrderService(env.D1_DATABASE)
  const productService = new ProductService(env.D1_DATABASE)
  const inventoryService = new InventoryService(env.D1_DATABASE)
  const downloadService = new DownloadService(env.D1_DATABASE, env.R2_BUCKET)

  // Create draft order (public)
  router.post('/', async (c) => {
    try {
      const body = await c.req.json()

      // Validate input
      const validationResult = OrderCreateSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const validatedBody = validationResult.data

      // Check product exists and is active
      const product = await productService.getById(validatedBody.productId)
      if (!product || !product.isActive) {
        return c.json({ error: 'Product not found or not available' }, 404)
      }

      // Validate quantity
      if (validatedBody.quantity < product.minQuantity) {
        return c.json({ error: `Minimum quantity is ${product.minQuantity}` }, 400)
      }

      if (product.maxQuantity && validatedBody.quantity > product.maxQuantity) {
        return c.json({ error: `Maximum quantity is ${product.maxQuantity}` }, 400)
      }

      // Check stock
      if (product.productType === 'license_code') {
        const availableCount = await inventoryService.getCountByProductId(validatedBody.productId)
        if (availableCount < validatedBody.quantity) {
          return c.json({ error: 'Insufficient stock' }, 400)
        }
      } else if (product.stock !== null && product.stock < validatedBody.quantity) {
        return c.json({ error: 'Insufficient stock' }, 400)
      }

      // Create order
      const order = await orderService.createDraftOrder(validatedBody)

      return c.json({ data: order }, 201)
    } catch (error) {
      console.error('Error creating order:', error)
      return c.json({ error: 'Failed to create order' }, 500)
    }
  })

  // Get order by ID (admin or authenticated user who owns the order)
  router.get('/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      if (isNaN(id)) {
        return c.json({ error: 'Invalid order ID' }, 400)
      }

      // Get user info from context (set by auth middleware)
      const userId = c.get('userId')
      const isAdmin = c.get('isAdmin') || false
      const role = c.get('role')

      // Require authentication (either admin or customer)
      if (!userId || (!isAdmin && role !== 'customer')) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      // Fetch the order
      const order = await orderService.getById(id)
      if (!order) {
        return c.json({ error: 'Order not found' }, 404)
      }

      // Authorization check: admin can access any order, customer can only access their own
      if (!isAdmin && order.userId !== userId) {
        return c.json({ error: 'Forbidden' }, 403)
      }

      // Get order items
      const orderItems = await orderService.getOrderItems(id)

      return c.json({
        data: {
          ...order,
          items: orderItems,
        },
      })
    } catch (error) {
      console.error('Error getting order:', error)
      return c.json({ error: 'Failed to get order' }, 500)
    }
  })

  // Mark order as paid (requires authentication: admin or order owner)
  router.post('/:id/pay', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      if (isNaN(id)) {
        return c.json({ error: 'Invalid order ID' }, 400)
      }

      // Get user info from context (set by auth middleware)
      const userId = c.get('userId')
      const isAdmin = c.get('isAdmin') || false
      const role = c.get('role')

      // Require authentication (either admin or customer)
      if (!userId || (!isAdmin && role !== 'customer')) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      // Fetch the order to check authorization and status
      const order = await orderService.getById(id)
      if (!order) {
        return c.json({ error: 'Order not found' }, 404)
      }

      // Authorization check: admin can mark any order as paid, customer can only mark their own
      if (!isAdmin && order.userId !== userId) {
        return c.json({ error: 'Forbidden' }, 403)
      }

      // Validate order status - only allow marking pending orders as paid
      // This prevents double-payment or marking already-paid orders
      if (order.status !== 'pending') {
        return c.json({ 
          error: 'Invalid order status',
          message: `Cannot mark order as paid. Current status: ${order.status}. Only pending orders can be marked as paid.`
        }, 400)
      }

      // Mark order as paid
      const updatedOrder = await orderService.markPaid(id)

      // Auto-fulfill if possible
      const orderItems = await orderService.getOrderItems(id)
      
      for (const item of orderItems) {
        const product = await productService.getById(item.productId)
        if (!product) continue

        if (product.productType === 'license_code') {
          // Allocate license codes
          const codes = await inventoryService.allocateCode(item.productId, id, item.quantity)
          const codeList = codes.map(c => 
            c.password ? `${c.licenseCode}:${c.password}` : c.licenseCode
          ).join('\n')

          await orderService.updateFulfillmentResult(id, codeList)
          await orderService.updateStatus(id, 'completed')
        } else if (product.productType === 'digital') {
          // Create download link
          await downloadService.createDownloadLink(id, item.productId, updatedOrder.userId || undefined)
          await orderService.updateStatus(id, 'completed')
        }
      }

      return c.json({ data: updatedOrder })
    } catch (error) {
      console.error('Error marking order as paid:', error)
      return c.json({ error: 'Failed to mark order as paid' }, 500)
    }
  })

  return router
}

