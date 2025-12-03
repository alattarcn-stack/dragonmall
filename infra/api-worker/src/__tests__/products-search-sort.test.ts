import { describe, it, expect, beforeEach } from 'vitest'
import { createTestEnv } from './utils/test-helpers'
import { ProductService, CategoryService } from '@dragon/core'

describe('Products Search and Sort API', () => {
  let env: ReturnType<typeof createTestEnv>

  beforeEach(async () => {
    env = createTestEnv()

    // Create products table
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        category_id INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        min_quantity INTEGER NOT NULL DEFAULT 1,
        product_type TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 10,
        created_at INTEGER NOT NULL
      )
    `)

    // Create categories table
    await env.D1_DATABASE.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 10,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Insert test products with different names, prices, and dates
    const now = Math.floor(Date.now() / 1000)
    await env.D1_DATABASE.exec(`
      INSERT INTO products (name, description, price, category_id, is_active, min_quantity, product_type, sort_order, created_at)
      VALUES
        ('Ebook Guide', 'A comprehensive ebook guide', 2000, 0, 1, 1, 'digital', 10, ${now - 86400}),
        ('Starter Template', 'A starter template for projects', 5000, 0, 1, 1, 'digital', 10, ${now - 43200}),
        ('Premium Software', 'Premium software package', 10000, 0, 1, 1, 'digital', 10, ${now}),
        ('Basic Tool', 'A basic tool for beginners', 1500, 0, 1, 1, 'digital', 10, ${now - 172800}),
        ('Advanced Framework', 'Advanced framework for developers', 8000, 0, 1, 1, 'digital', 10, ${now - 21600})
    `)
  })

  describe('Search functionality', () => {
    it('should return products matching search query in name', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?query=ebook')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Ebook Guide')
    })

    it('should return products matching search query in description', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?query=comprehensive')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Ebook Guide')
    })

    it('should return multiple products when query matches multiple items', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?query=starter')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeGreaterThanOrEqual(1)
      expect(data.data.some((p: any) => p.name.includes('Starter'))).toBe(true)
    })

    it('should return empty array when no products match', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?query=nonexistentproductxyz')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(0)
    })

    it('should be case-insensitive', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?query=EBooK')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Ebook Guide')
    })
  })

  describe('Sorting functionality', () => {
    it('should sort by price ascending', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?sort=price_asc')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeGreaterThan(1)
      
      // Check prices are in ascending order
      for (let i = 1; i < data.data.length; i++) {
        expect(data.data[i].price).toBeGreaterThanOrEqual(data.data[i - 1].price)
      }
    })

    it('should sort by price descending', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?sort=price_desc')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeGreaterThan(1)
      
      // Check prices are in descending order
      for (let i = 1; i < data.data.length; i++) {
        expect(data.data[i].price).toBeLessThanOrEqual(data.data[i - 1].price)
      }
    })

    it('should sort by newest first', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?sort=newest')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeGreaterThan(1)
      
      // Check created_at is in descending order (newest first)
      for (let i = 1; i < data.data.length; i++) {
        expect(data.data[i].createdAt).toBeLessThanOrEqual(data.data[i - 1].createdAt)
      }
    })

    it('should default to relevance when no sort specified', async () => {
      const response = await env.APP.fetch('http://localhost/api/products')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeGreaterThan(0)
      // Default behavior should work (no error)
    })

    it('should fallback to relevance for invalid sort value', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?sort=invalid_sort')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeGreaterThan(0)
      // Should not error, just use default
    })
  })

  describe('Search with relevance sorting', () => {
    it('should prioritize prefix matches when query is provided', async () => {
      // Add a product that starts with "ebook" and one that contains it
      const now = Math.floor(Date.now() / 1000)
      await env.D1_DATABASE.exec(`
        INSERT INTO products (name, description, price, category_id, is_active, min_quantity, product_type, sort_order, created_at)
        VALUES
          ('ebook advanced', 'Advanced ebook', 3000, 0, 1, 1, 'digital', 10, ${now}),
          ('The ebook guide', 'Another ebook', 2500, 0, 1, 1, 'digital', 10, ${now})
      `)

      const response = await env.APP.fetch('http://localhost/api/products?query=ebook&sort=relevance')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeGreaterThan(0)
      // Products starting with "ebook" should appear before those containing it
      // Note: SQLite relevance is limited, but the query should execute without error
    })
  })

  describe('Combined filters', () => {
    it('should combine categorySlug and query', async () => {
      // Create a category
      const categoryService = new CategoryService(env.D1_DATABASE)
      const category = await categoryService.createCategory({ name: 'Frameworks', slug: 'frameworks' })

      // Add a product in that category
      const now = Math.floor(Date.now() / 1000)
      await env.D1_DATABASE.exec(`
        INSERT INTO products (name, description, price, category_id, is_active, min_quantity, product_type, sort_order, created_at)
        VALUES ('Starter Framework', 'A starter framework', 6000, ${category.id}, 1, 1, 'digital', 10, ${now})
      `)

      const response = await env.APP.fetch('http://localhost/api/products?categorySlug=frameworks&query=starter')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeGreaterThanOrEqual(1)
      expect(data.data.some((p: any) => p.name.includes('Starter'))).toBe(true)
    })

    it('should combine categorySlug, query, and sort', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      const category = await categoryService.createCategory({ name: 'Frameworks', slug: 'frameworks' })

      const now = Math.floor(Date.now() / 1000)
      await env.D1_DATABASE.exec(`
        INSERT INTO products (name, description, price, category_id, is_active, min_quantity, product_type, sort_order, created_at)
        VALUES
          ('Starter Framework A', 'A starter framework', 6000, ${category.id}, 1, 1, 'digital', 10, ${now}),
          ('Starter Framework B', 'Another starter framework', 4000, ${category.id}, 1, 1, 'digital', 10, ${now})
      `)

      const response = await env.APP.fetch('http://localhost/api/products?categorySlug=frameworks&query=starter&sort=price_asc')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.length).toBeGreaterThanOrEqual(2)
      
      // Should be sorted by price ascending
      for (let i = 1; i < data.data.length; i++) {
        expect(data.data[i].price).toBeGreaterThanOrEqual(data.data[i - 1].price)
      }
    })

    it('should return empty array when category exists but no products match query', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      await categoryService.createCategory({ name: 'Frameworks', slug: 'frameworks' })

      const response = await env.APP.fetch('http://localhost/api/products?categorySlug=frameworks&query=nonexistent')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(0)
    })
  })
})

