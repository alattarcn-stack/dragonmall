import { Hono } from 'hono'
import type { Env } from '../types'
import { OrderService, DownloadService } from '@dragon/core'

export function createCustomerRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const orderService = new OrderService(env.D1_DATABASE)
  const downloadService = new DownloadService(env.D1_DATABASE, env.R2_BUCKET)

  // GET /orders/mine - Get current customer's orders
  router.get('/orders/mine', async (c) => {
    try {
      const userId = c.get('userId')
      
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const orders = await orderService.getByUserId(userId)

      // Get order items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await orderService.getOrderItems(order.id)
          return {
            ...order,
            items,
          }
        })
      )

      return c.json({ data: ordersWithItems })
    } catch (error) {
      console.error('Error fetching customer orders:', error)
      return c.json({ error: 'Failed to fetch orders' }, 500)
    }
  })

  // GET /downloads/mine - Get current customer's downloads
  router.get('/downloads/mine', async (c) => {
    try {
      const userId = c.get('userId')
      
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      // Get all orders for this user
      const orders = await orderService.getByUserId(userId)
      const orderIds = orders.map(o => o.id)

      if (orderIds.length === 0) {
        return c.json({ data: [] })
      }

      // Get downloads for all user's orders
      const downloads: any[] = []
      for (const orderId of orderIds) {
        const orderDownloads = await downloadService.getByOrderId(orderId)
        downloads.push(...orderDownloads)
      }

      // Enrich with product information
      const downloadsWithProducts = await Promise.all(
        downloads.map(async (download) => {
          // Get product info
          const productResult = await env.D1_DATABASE
            .prepare('SELECT id, name FROM products WHERE id = ?')
            .bind(download.productId)
            .first<{ id: number; name: string }>()

          // Get order info
          const orderResult = await env.D1_DATABASE
            .prepare('SELECT id, created_at, status FROM orders WHERE id = ?')
            .bind(download.orderId)
            .first<{ id: number; created_at: number; status: string }>()

          return {
            ...download,
            productName: productResult?.name || 'Unknown Product',
            orderDate: orderResult?.created_at || null,
            orderStatus: orderResult?.status || 'unknown',
          }
        })
      )

      return c.json({ data: downloadsWithProducts })
    } catch (error) {
      console.error('Error fetching customer downloads:', error)
      return c.json({ error: 'Failed to fetch downloads' }, 500)
    }
  })

  return router
}

