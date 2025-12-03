import { Hono } from 'hono'
import type { Env } from '../types'
import { OrderService, ProductService, InventoryService, DownloadService } from '@dragon/core'
import { OrderCreateSchema, formatValidationError } from '../validation/schemas'
import { makeError, ErrorCodes } from '../utils/errors'
import { logOrderStatusChange, logOrderPaid, logOrderFulfilled } from '../utils/audit-log'

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
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Product not found or not available'), 404)
      }

      // Validate quantity
      if (validatedBody.quantity < product.minQuantity) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, `Minimum quantity is ${product.minQuantity}`, { minQuantity: product.minQuantity }), 400)
      }

      if (product.maxQuantity && validatedBody.quantity > product.maxQuantity) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, `Maximum quantity is ${product.maxQuantity}`, { maxQuantity: product.maxQuantity }), 400)
      }

      // Check stock
      if (product.productType === 'license_code') {
        const availableCount = await inventoryService.getCountByProductId(validatedBody.productId)
        if (availableCount < validatedBody.quantity) {
          return c.json(makeError(ErrorCodes.INSUFFICIENT_STOCK, 'Insufficient stock', { available: availableCount, requested: validatedBody.quantity }), 400)
        }
      } else if (product.stock !== null && product.stock < validatedBody.quantity) {
        return c.json(makeError(ErrorCodes.INSUFFICIENT_STOCK, 'Insufficient stock', { available: product.stock, requested: validatedBody.quantity }), 400)
      }

      // Create order
      const order = await orderService.createDraftOrder(validatedBody)

      return c.json({ data: order }, 201)
    } catch (error) {
      console.error('Error creating order:', error)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to create order'), 500)
    }
  })

  // Get order by ID (admin or authenticated user who owns the order)
  router.get('/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      if (isNaN(id)) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, 'Invalid order ID'), 400)
      }

      // Get user info from context (set by auth middleware)
      const userId = c.get('userId')
      const isAdmin = c.get('isAdmin') || false
      const role = c.get('role')

      // Require authentication (either admin or customer)
      if (!userId || (!isAdmin && role !== 'customer')) {
        return c.json(makeError(ErrorCodes.UNAUTHORIZED, 'Authentication required'), 401)
      }

      // Fetch the order
      const order = await orderService.getById(id)
      if (!order) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Order not found'), 404)
      }

      // Authorization check: admin can access any order, customer can only access their own
      if (!isAdmin && order.userId !== userId) {
        return c.json(makeError(ErrorCodes.FORBIDDEN, 'Access denied'), 403)
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
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to get order'), 500)
    }
  })

  // Mark order as paid (requires authentication: admin or order owner)
  router.post('/:id/pay', async (c) => {
    try {
      const id = parseInt(c.req.param('id'), 10)
      if (isNaN(id)) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, 'Invalid order ID'), 400)
      }

      // Get user info from context (set by auth middleware)
      const userId = c.get('userId')
      const isAdmin = c.get('isAdmin') || false
      const role = c.get('role')

      // Require authentication (either admin or customer)
      if (!userId || (!isAdmin && role !== 'customer')) {
        return c.json(makeError(ErrorCodes.UNAUTHORIZED, 'Authentication required'), 401)
      }

      // Fetch the order to check authorization and status
      const order = await orderService.getById(id)
      if (!order) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Order not found'), 404)
      }

      // Authorization check: admin can mark any order as paid, customer can only mark their own
      if (!isAdmin && order.userId !== userId) {
        return c.json(makeError(ErrorCodes.FORBIDDEN, 'Access denied'), 403)
      }

      // Validate order status - only allow marking pending orders as paid
      // This prevents double-payment or marking already-paid orders
      if (order.status !== 'pending') {
        return c.json(makeError(ErrorCodes.ORDER_NOT_PENDING, `Cannot mark order as paid. Current status: ${order.status}. Only pending orders can be marked as paid.`, { currentStatus: order.status }), 400)
      }

      // Get old status for audit log
      const oldStatus = order.status

      // Mark order as paid
      const updatedOrder = await orderService.markPaid(id)

      // Audit log: Order status change (pending -> processing)
      const requestId = c.get('requestId')
      logOrderStatusChange(
        id,
        oldStatus,
        updatedOrder.status,
        userId || null,
        isAdmin ? 'admin' : 'user',
        requestId,
        c.env
      )

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
          const fulfilledOrder = await orderService.updateStatus(id, 'completed')
          
          // Audit log: Order fulfilled
          logOrderFulfilled(
            id,
            userId || null,
            isAdmin ? 'admin' : 'user',
            requestId,
            c.env
          )
          
          // Audit log: Order status change (processing -> completed)
          logOrderStatusChange(
            id,
            'processing',
            fulfilledOrder.status,
            userId || null,
            isAdmin ? 'admin' : 'user',
            requestId,
            c.env
          )
        } else if (product.productType === 'digital') {
          // Create download link
          await downloadService.createDownloadLink(id, item.productId, updatedOrder.userId || undefined)
          const fulfilledOrder = await orderService.updateStatus(id, 'completed')
          
          // Audit log: Order fulfilled
          logOrderFulfilled(
            id,
            userId || null,
            isAdmin ? 'admin' : 'user',
            requestId,
            c.env
          )
          
          // Audit log: Order status change (processing -> completed)
          logOrderStatusChange(
            id,
            'processing',
            fulfilledOrder.status,
            userId || null,
            isAdmin ? 'admin' : 'user',
            requestId,
            c.env
          )
        }
      }

      return c.json({ data: updatedOrder })
    } catch (error) {
      console.error('Error marking order as paid:', error)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to mark order as paid'), 500)
    }
  })

  return router
}

