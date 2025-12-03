import { describe, it, expect, beforeEach } from 'vitest'
import { CouponService } from '../services/coupon.service'
import { MockD1Database } from './utils/mock-d1'
import type { Coupon, Order } from '../types'

describe('CouponService', () => {
  let db: MockD1Database
  let service: CouponService

  beforeEach(() => {
    db = new MockD1Database()
    service = new CouponService(db as any)
    
    // Create coupons table
    db.exec(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
        amount INTEGER NOT NULL,
        currency TEXT,
        max_uses INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        per_user_limit INTEGER,
        min_order_amount INTEGER,
        starts_at INTEGER,
        ends_at INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Create orders table for validation tests
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_email TEXT NOT NULL,
        amount INTEGER NOT NULL,
        coupon_code TEXT,
        discount_amount INTEGER NOT NULL DEFAULT 0,
        subtotal_amount INTEGER,
        total_amount INTEGER,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
  })

  describe('getCouponByCode', () => {
    it('should return coupon by code (case-insensitive)', async () => {
      const now = Math.floor(Date.now() / 1000)
      db.exec(`
        INSERT INTO coupons (code, type, amount, is_active, created_at, updated_at)
        VALUES ('SAVE10', 'percentage', 10, 1, ${now}, ${now})
      `)

      const coupon = await service.getCouponByCode('save10')
      expect(coupon).not.toBeNull()
      expect(coupon?.code).toBe('SAVE10')
    })

    it('should return null for non-existent code', async () => {
      const coupon = await service.getCouponByCode('INVALID')
      expect(coupon).toBeNull()
    })
  })

  describe('applyCouponToAmount', () => {
    it('should apply percentage discount correctly', () => {
      const coupon: Coupon = {
        id: 1,
        code: 'SAVE10',
        type: 'percentage',
        amount: 10, // 10%
        isActive: 1,
        usedCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const result = service.applyCouponToAmount(10000, coupon) // $100.00
      expect(result.discount).toBe(1000) // $10.00
      expect(result.total).toBe(9000) // $90.00
    })

    it('should apply fixed discount correctly', () => {
      const coupon: Coupon = {
        id: 1,
        code: 'SAVE5',
        type: 'fixed',
        amount: 500, // $5.00
        isActive: 1,
        usedCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const result = service.applyCouponToAmount(10000, coupon) // $100.00
      expect(result.discount).toBe(500) // $5.00
      expect(result.total).toBe(9500) // $95.00
    })

    it('should not allow discount to exceed amount', () => {
      const coupon: Coupon = {
        id: 1,
        code: 'SAVE50',
        type: 'fixed',
        amount: 5000, // $50.00
        isActive: 1,
        usedCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const result = service.applyCouponToAmount(3000, coupon) // $30.00
      expect(result.discount).toBe(3000) // Limited to $30.00
      expect(result.total).toBe(0) // $0.00
    })

    it('should handle 100% percentage discount', () => {
      const coupon: Coupon = {
        id: 1,
        code: 'FREE',
        type: 'percentage',
        amount: 100, // 100%
        isActive: 1,
        usedCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const result = service.applyCouponToAmount(10000, coupon)
      expect(result.discount).toBe(10000)
      expect(result.total).toBe(0)
    })
  })

  describe('validateCouponForCart', () => {
    it('should reject inactive coupon', async () => {
      const coupon: Coupon = {
        id: 1,
        code: 'INACTIVE',
        type: 'percentage',
        amount: 10,
        isActive: 0,
        usedCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const order: Order = {
        id: 1,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 10000,
        discountAmount: 0,
        status: 'cart',
        createdAt: Date.now(),
      }

      const result = await service.validateCouponForCart({ coupon, order })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Coupon is not active')
    })

    it('should reject expired coupon', async () => {
      const now = Math.floor(Date.now() / 1000)
      const coupon: Coupon = {
        id: 1,
        code: 'EXPIRED',
        type: 'percentage',
        amount: 10,
        isActive: 1,
        usedCount: 0,
        endsAt: now - 86400, // Expired yesterday
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const order: Order = {
        id: 1,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 10000,
        discountAmount: 0,
        status: 'cart',
        createdAt: Date.now(),
      }

      const result = await service.validateCouponForCart({ coupon, order })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Coupon has expired')
    })

    it('should reject coupon that has not started', async () => {
      const now = Math.floor(Date.now() / 1000)
      const coupon: Coupon = {
        id: 1,
        code: 'FUTURE',
        type: 'percentage',
        amount: 10,
        isActive: 1,
        usedCount: 0,
        startsAt: now + 86400, // Starts tomorrow
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const order: Order = {
        id: 1,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 10000,
        discountAmount: 0,
        status: 'cart',
        createdAt: Date.now(),
      }

      const result = await service.validateCouponForCart({ coupon, order })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Coupon has not started yet')
    })

    it('should reject coupon that exceeded max uses', async () => {
      const coupon: Coupon = {
        id: 1,
        code: 'MAXED',
        type: 'percentage',
        amount: 10,
        isActive: 1,
        maxUses: 5,
        usedCount: 5, // Already used 5 times
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const order: Order = {
        id: 1,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 10000,
        discountAmount: 0,
        status: 'cart',
        createdAt: Date.now(),
      }

      const result = await service.validateCouponForCart({ coupon, order })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Coupon has reached maximum uses')
    })

    it('should reject if order amount is below minimum', async () => {
      const coupon: Coupon = {
        id: 1,
        code: 'MIN50',
        type: 'percentage',
        amount: 10,
        isActive: 1,
        usedCount: 0,
        minOrderAmount: 5000, // $50.00 minimum
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const order: Order = {
        id: 1,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 3000, // $30.00 - below minimum
        discountAmount: 0,
        status: 'cart',
        createdAt: Date.now(),
      }

      const result = await service.validateCouponForCart({ coupon, order })
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Minimum order amount')
    })

    it('should accept valid coupon', async () => {
      const coupon: Coupon = {
        id: 1,
        code: 'VALID',
        type: 'percentage',
        amount: 10,
        isActive: 1,
        usedCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const order: Order = {
        id: 1,
        customerEmail: 'test@example.com',
        quantity: 1,
        amount: 10000,
        discountAmount: 0,
        status: 'cart',
        createdAt: Date.now(),
      }

      const result = await service.validateCouponForCart({ coupon, order })
      expect(result.valid).toBe(true)
    })
  })

  describe('incrementCouponUsage', () => {
    it('should increment used_count', async () => {
      const now = Math.floor(Date.now() / 1000)
      db.exec(`
        INSERT INTO coupons (code, type, amount, used_count, is_active, created_at, updated_at)
        VALUES ('TEST', 'percentage', 10, 0, 1, ${now}, ${now})
      `)

      await service.incrementCouponUsage(1)

      const coupon = await service.getCouponById(1)
      expect(coupon?.usedCount).toBe(1)
    })
  })
})

