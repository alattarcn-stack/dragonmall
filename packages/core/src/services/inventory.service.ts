import type { InventoryItem } from '../types'
import type { D1Database } from '@cloudflare/workers-types'

export class InventoryService {
  constructor(private db: D1Database) {}

  async getAvailableByProductId(productId: number): Promise<InventoryItem[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM inventory_items WHERE product_id = ? AND order_id IS NULL ORDER BY created_at ASC'
      )
      .bind(productId)
      .all<any>()

    // Map snake_case to camelCase
    return (result.results || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      licenseCode: item.license_code,
      password: item.password || null,
      orderId: item.order_id || null,
      createdAt: item.created_at,
      allocatedAt: item.allocated_at || null,
    }))
  }

  async getCountByProductId(productId: number): Promise<number> {
    const result = await this.db
      .prepare(
        'SELECT COUNT(*) as count FROM inventory_items WHERE product_id = ? AND order_id IS NULL'
      )
      .bind(productId)
      .first<{ count: number }>()

    return result?.count || 0
  }

  async allocateCode(productId: number, orderId: number, quantity: number): Promise<InventoryItem[]> {
    // Get available codes
    const available = await this.getAvailableByProductId(productId)

    if (available.length < quantity) {
      throw new Error(`Insufficient inventory. Available: ${available.length}, Requested: ${quantity}`)
    }

    const allocated: InventoryItem[] = []
    const allocatedAt = Math.floor(Date.now() / 1000)

    // Allocate codes
    for (let i = 0; i < quantity; i++) {
      const item = available[i]
      
      await this.db
        .prepare('UPDATE inventory_items SET order_id = ?, allocated_at = ? WHERE id = ?')
        .bind(orderId, allocatedAt, item.id)
        .run()

      allocated.push({
        id: item.id,
        productId: item.productId || item.product_id,
        licenseCode: item.licenseCode || item.license_code,
        password: item.password || null,
        orderId,
        createdAt: item.createdAt || item.created_at,
        allocatedAt,
      })
    }

    return allocated
  }

  async addItems(
    productId: number,
    items: Array<{ licenseCode: string; password?: string }>
  ): Promise<void> {
    const createdAt = Math.floor(Date.now() / 1000)

    const stmt = this.db.prepare(
      'INSERT INTO inventory_items (product_id, license_code, password, created_at) VALUES (?, ?, ?, ?)'
    )

    // Batch insert
    const batch = items.map(item =>
      stmt.bind(productId, item.licenseCode, item.password || null, createdAt)
    )

    await this.db.batch(batch)
  }

  async getByOrderId(orderId: number): Promise<InventoryItem[]> {
    const result = await this.db
      .prepare('SELECT * FROM inventory_items WHERE order_id = ?')
      .bind(orderId)
      .all<any>()

    // Map snake_case to camelCase
    return (result.results || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      licenseCode: item.license_code,
      password: item.password || null,
      orderId: item.order_id || null,
      createdAt: item.created_at,
      allocatedAt: item.allocated_at || null,
    }))
  }
}
