import { describe, it, expect, beforeEach } from 'vitest'
import { createTestEnv, createTestAdmin } from './utils/test-helpers'
import { CategoryService } from '@dragon/core'

describe('Categories API', () => {
  let env: ReturnType<typeof createTestEnv>
  let adminToken: string

  beforeEach(async () => {
    env = createTestEnv()
    const admin = await createTestAdmin(env)
    adminToken = admin.token

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
  })

  describe('GET /api/admin/categories', () => {
    it('should list all categories for admin', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      await categoryService.createCategory({ name: 'Test Category', slug: 'test-category' })

      const response = await env.APP.fetch('http://localhost/api/admin/categories', {
        headers: {
          'Cookie': `admin_token=${adminToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toBeInstanceOf(Array)
      expect(data.data.length).toBeGreaterThan(0)
    })

    it('should require admin authentication', async () => {
      const response = await env.APP.fetch('http://localhost/api/admin/categories')
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/admin/categories', () => {
    it('should create a new category', async () => {
      const response = await env.APP.fetch('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `admin_token=${adminToken}`,
        },
        body: JSON.stringify({
          name: 'New Category',
          slug: 'new-category',
          description: 'A new category',
          sortOrder: 5,
          isActive: true,
        }),
      })

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.data.name).toBe('New Category')
      expect(data.data.slug).toBe('new-category')
    })

    it('should validate slug format', async () => {
      const response = await env.APP.fetch('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `admin_token=${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Invalid Slug',
          slug: 'Invalid Slug!',
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should prevent duplicate slugs', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      await categoryService.createCategory({ name: 'Existing', slug: 'existing' })

      const response = await env.APP.fetch('http://localhost/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `admin_token=${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Duplicate',
          slug: 'existing',
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('already exists')
    })
  })

  describe('PUT /api/admin/categories/:id', () => {
    it('should update a category', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      const category = await categoryService.createCategory({ name: 'Original', slug: 'original' })

      const response = await env.APP.fetch(`http://localhost/api/admin/categories/${category.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `admin_token=${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Updated',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.name).toBe('Updated')
    })
  })

  describe('DELETE /api/admin/categories/:id', () => {
    it('should delete a category', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      const category = await categoryService.createCategory({ name: 'To Delete', slug: 'to-delete' })

      const response = await env.APP.fetch(`http://localhost/api/admin/categories/${category.id}`, {
        method: 'DELETE',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `admin_token=${adminToken}`,
        },
      })

      expect(response.status).toBe(200)
      
      const found = await categoryService.getCategoryById(category.id)
      expect(found).toBeNull()
    })

    it('should prevent deletion if category has products', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      const category = await categoryService.createCategory({ name: 'With Products', slug: 'with-products' })

      // Create a product referencing this category
      await env.D1_DATABASE.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category_id INTEGER NOT NULL DEFAULT 0
        )
      `)
      await env.D1_DATABASE.exec(`INSERT INTO products (name, category_id) VALUES ('Test Product', ${category.id})`)

      const response = await env.APP.fetch(`http://localhost/api/admin/categories/${category.id}`, {
        method: 'DELETE',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `admin_token=${adminToken}`,
        },
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('product(s) are using this category')
    })
  })

  describe('GET /api/categories', () => {
    it('should return only active categories', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      await categoryService.createCategory({ name: 'Active', slug: 'active', isActive: true })
      await categoryService.createCategory({ name: 'Inactive', slug: 'inactive', isActive: false })

      const response = await env.APP.fetch('http://localhost/api/categories')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].slug).toBe('active')
    })

    it('should return basic fields only', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      await categoryService.createCategory({ name: 'Test', slug: 'test', description: 'Description' })

      const response = await env.APP.fetch('http://localhost/api/categories')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data[0]).toHaveProperty('id')
      expect(data.data[0]).toHaveProperty('name')
      expect(data.data[0]).toHaveProperty('slug')
      expect(data.data[0]).toHaveProperty('sortOrder')
      expect(data.data[0]).not.toHaveProperty('description')
      expect(data.data[0]).not.toHaveProperty('isActive')
    })
  })

  describe('Product filtering by category', () => {
    beforeEach(async () => {
      // Create products table
      await env.D1_DATABASE.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price INTEGER NOT NULL,
          category_id INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          min_quantity INTEGER NOT NULL DEFAULT 1,
          product_type TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 10,
          created_at INTEGER NOT NULL
        )
      `)
    })

    it('should filter products by categorySlug', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      const category = await categoryService.createCategory({ name: 'Software', slug: 'software' })

      // Create products
      await env.D1_DATABASE.exec(`
        INSERT INTO products (name, price, category_id, is_active, min_quantity, product_type, sort_order, created_at)
        VALUES 
          ('Product 1', 1000, ${category.id}, 1, 1, 'digital', 10, ${Math.floor(Date.now() / 1000)}),
          ('Product 2', 2000, 0, 1, 1, 'digital', 10, ${Math.floor(Date.now() / 1000)})
      `)

      const response = await env.APP.fetch('http://localhost/api/products?categorySlug=software')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].name).toBe('Product 1')
    })

    it('should return empty array for non-existent category slug', async () => {
      const response = await env.APP.fetch('http://localhost/api/products?categorySlug=non-existent')

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(0)
    })

    it('should still support categoryId for backward compatibility', async () => {
      const categoryService = new CategoryService(env.D1_DATABASE)
      const category = await categoryService.createCategory({ name: 'Tools', slug: 'tools' })

      await env.D1_DATABASE.exec(`
        INSERT INTO products (name, price, category_id, is_active, min_quantity, product_type, sort_order, created_at)
        VALUES ('Product', 1000, ${category.id}, 1, 1, 'digital', 10, ${Math.floor(Date.now() / 1000)})
      `)

      const response = await env.APP.fetch(`http://localhost/api/products?categoryId=${category.id}`)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(1)
    })
  })
})

