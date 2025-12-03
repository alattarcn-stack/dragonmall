import { describe, it, expect, beforeEach } from 'vitest'
import { CategoryService } from '../services/category.service'
import { MockD1Database } from './utils/mock-d1'
import type { Category } from '../types'

describe('CategoryService', () => {
  let db: MockD1Database
  let service: CategoryService

  beforeEach(() => {
    db = new MockD1Database()
    service = new CategoryService(db as any)
    
    // Create categories table
    db.exec(`
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

  describe('createCategory', () => {
    it('should create a new category', async () => {
      const category = await service.createCategory({
        name: 'Software',
        slug: 'software',
        description: 'Software products',
        sortOrder: 10,
        isActive: true,
      })

      expect(category.id).toBeDefined()
      expect(category.name).toBe('Software')
      expect(category.slug).toBe('software')
      expect(category.description).toBe('Software products')
      expect(category.sortOrder).toBe(10)
      expect(category.isActive).toBe(1)
    })

    it('should use default values when optional fields are not provided', async () => {
      const category = await service.createCategory({
        name: 'Tools',
        slug: 'tools',
      })

      expect(category.sortOrder).toBe(10)
      expect(category.isActive).toBe(1)
    })
  })

  describe('listCategories', () => {
    it('should list only active categories by default', async () => {
      await service.createCategory({ name: 'Active Category', slug: 'active', isActive: true })
      await service.createCategory({ name: 'Inactive Category', slug: 'inactive', isActive: false })

      const categories = await service.listCategories()

      expect(categories).toHaveLength(1)
      expect(categories[0].name).toBe('Active Category')
    })

    it('should list all categories when includeInactive is true', async () => {
      await service.createCategory({ name: 'Active Category', slug: 'active', isActive: true })
      await service.createCategory({ name: 'Inactive Category', slug: 'inactive', isActive: false })

      const categories = await service.listCategories({ includeInactive: true })

      expect(categories).toHaveLength(2)
    })

    it('should sort by sortOrder then name', async () => {
      await service.createCategory({ name: 'B Category', slug: 'b', sortOrder: 20 })
      await service.createCategory({ name: 'A Category', slug: 'a', sortOrder: 10 })
      await service.createCategory({ name: 'C Category', slug: 'c', sortOrder: 10 })

      const categories = await service.listCategories()

      expect(categories[0].name).toBe('A Category')
      expect(categories[1].name).toBe('C Category')
      expect(categories[2].name).toBe('B Category')
    })
  })

  describe('getCategoryById', () => {
    it('should return category by ID', async () => {
      const created = await service.createCategory({ name: 'Test', slug: 'test' })
      const found = await service.getCategoryById(created.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.name).toBe('Test')
    })

    it('should return null for non-existent category', async () => {
      const found = await service.getCategoryById(999)
      expect(found).toBeNull()
    })
  })

  describe('getCategoryBySlug', () => {
    it('should return category by slug', async () => {
      await service.createCategory({ name: 'Test Category', slug: 'test-category' })
      const found = await service.getCategoryBySlug('test-category')

      expect(found).not.toBeNull()
      expect(found?.slug).toBe('test-category')
    })

    it('should return null for non-existent slug', async () => {
      const found = await service.getCategoryBySlug('non-existent')
      expect(found).toBeNull()
    })
  })

  describe('updateCategory', () => {
    it('should update category fields', async () => {
      const created = await service.createCategory({ name: 'Original', slug: 'original' })
      const updated = await service.updateCategory(created.id, {
        name: 'Updated',
        description: 'Updated description',
      })

      expect(updated.name).toBe('Updated')
      expect(updated.description).toBe('Updated description')
      expect(updated.slug).toBe('original') // Unchanged
    })

    it('should update updated_at timestamp', async () => {
      const created = await service.createCategory({ name: 'Test', slug: 'test' })
      const originalUpdatedAt = created.updatedAt
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const updated = await service.updateCategory(created.id, { name: 'Updated' })
      
      expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })

    it('should throw error for non-existent category', async () => {
      await expect(
        service.updateCategory(999, { name: 'Updated' })
      ).rejects.toThrow('Category not found')
    })
  })

  describe('deleteCategory', () => {
    it('should delete a category', async () => {
      const created = await service.createCategory({ name: 'To Delete', slug: 'to-delete' })
      await service.deleteCategory(created.id)

      const found = await service.getCategoryById(created.id)
      expect(found).toBeNull()
    })

    it('should throw error when category has products', async () => {
      const category = await service.createCategory({ name: 'With Products', slug: 'with-products' })
      
      // Create products table and add a product referencing this category
      db.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category_id INTEGER NOT NULL DEFAULT 0
        )
      `)
      db.exec(`INSERT INTO products (name, category_id) VALUES ('Test Product', ${category.id})`)

      await expect(
        service.deleteCategory(category.id)
      ).rejects.toThrow('Cannot delete category')
    })

    it('should throw error for non-existent category', async () => {
      await expect(
        service.deleteCategory(999)
      ).rejects.toThrow('Category not found')
    })
  })
})

