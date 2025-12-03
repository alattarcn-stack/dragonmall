import { describe, it, expect, beforeEach } from 'vitest'
import { InventoryService } from '../services/inventory.service'
import { MockD1Database } from './utils/mock-d1'

describe('InventoryService', () => {
  let db: MockD1Database
  let inventoryService: InventoryService

  beforeEach(() => {
    db = new MockD1Database()
    inventoryService = new InventoryService(db as any)
    
    // Setup: Add some inventory items
    const inventoryTable = db._getTable('inventory_items')
    inventoryTable.set(1, {
      id: 1,
      product_id: 1,
      license_code: 'CODE001',
      password: null,
      order_id: null,
      created_at: Math.floor(Date.now() / 1000),
      allocated_at: null,
    })
    inventoryTable.set(2, {
      id: 2,
      product_id: 1,
      license_code: 'CODE002',
      password: 'pass123',
      order_id: null,
      created_at: Math.floor(Date.now() / 1000),
      allocated_at: null,
    })
    inventoryTable.set(3, {
      id: 3,
      product_id: 1,
      license_code: 'CODE003',
      password: null,
      order_id: null,
      created_at: Math.floor(Date.now() / 1000),
      allocated_at: null,
    })
  })

  describe('getAvailableByProductId', () => {
    it('should get available inventory items for a product', async () => {
      const items = await inventoryService.getAvailableByProductId(1)
      expect(items.length).toBe(3)
      expect(items[0].licenseCode).toBe('CODE001')
    })

    it('should exclude allocated items', async () => {
      // Allocate one item
      const allocated = await inventoryService.allocateCode(1, 100, 1)
      expect(allocated.length).toBe(1)

      // Check available count
      const count = await inventoryService.getCountByProductId(1)
      expect(count).toBe(2) // 3 - 1 allocated
    })
  })

  describe('getCountByProductId', () => {
    it('should return count of available items', async () => {
      const count = await inventoryService.getCountByProductId(1)
      expect(count).toBe(3)
    })

    it('should return 0 for non-existent product', async () => {
      const count = await inventoryService.getCountByProductId(999)
      expect(count).toBe(0)
    })
  })

  describe('allocateCode', () => {
    it('should allocate a license code to an order', async () => {
      const orderId = 100
      const allocated = await inventoryService.allocateCode(1, orderId, 1)

      expect(allocated.length).toBe(1)
      expect(allocated[0].orderId).toBe(orderId)
      expect(allocated[0].allocatedAt).toBeDefined()

      // Verify it's no longer available
      const count = await inventoryService.getCountByProductId(1)
      expect(count).toBe(2)
    })

    it('should allocate multiple codes', async () => {
      const orderId = 100
      const allocated = await inventoryService.allocateCode(1, orderId, 2)

      expect(allocated.length).toBe(2)
      expect(allocated[0].orderId).toBe(orderId)
      expect(allocated[1].orderId).toBe(orderId)

      // Verify count decreased
      const count = await inventoryService.getCountByProductId(1)
      expect(count).toBe(1)
    })

    it('should throw error if insufficient inventory', async () => {
      await expect(
        inventoryService.allocateCode(1, 100, 10) // Request 10, only 3 available
      ).rejects.toThrow('Insufficient inventory')
    })
  })

  describe('addItems', () => {
    it('should add new inventory items', async () => {
      const initialCount = await inventoryService.getCountByProductId(1)

      await inventoryService.addItems(1, [
        { licenseCode: 'NEW001' },
        { licenseCode: 'NEW002', password: 'pass456' },
      ])

      const newCount = await inventoryService.getCountByProductId(1)
      expect(newCount).toBe(initialCount + 2)
    })
  })

  describe('getByOrderId', () => {
    it('should get inventory items allocated to an order', async () => {
      const orderId = 100
      await inventoryService.allocateCode(1, orderId, 2)

      const items = await inventoryService.getByOrderId(orderId)
      expect(items.length).toBe(2)
      expect(items[0].orderId).toBe(orderId)
      expect(items[1].orderId).toBe(orderId)
    })
  })
})

