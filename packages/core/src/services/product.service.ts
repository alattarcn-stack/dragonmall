import type { Product } from '../types'
import type { D1Database } from '@cloudflare/workers-types'

export class ProductService {
  constructor(private db: D1Database) {}

  async getById(id: number): Promise<Product | null> {
    const result = await this.db
      .prepare('SELECT * FROM products WHERE id = ?')
      .bind(id)
      .first<Product>()

    return result || null
  }

  async getBySlug(slug: string): Promise<Product | null> {
    // For now, slug is just the ID. Can be enhanced later with a slug column
    const id = parseInt(slug, 10)
    if (isNaN(id)) {
      return null
    }
    return this.getById(id)
  }

  async listProducts(options?: {
    categoryId?: number
    isActive?: boolean
    productType?: 'digital' | 'license_code'
    query?: string
    sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest'
    limit?: number
    offset?: number
  }): Promise<Product[]> {
    let query = 'SELECT * FROM products WHERE 1=1'
    const binds: unknown[] = []

    if (options?.categoryId !== undefined) {
      query += ' AND category_id = ?'
      binds.push(options.categoryId)
    }

    if (options?.isActive !== undefined) {
      query += ' AND is_active = ?'
      binds.push(options.isActive ? 1 : 0)
    }

    if (options?.productType) {
      query += ' AND product_type = ?'
      binds.push(options.productType)
    }

    // Search functionality
    if (options?.query && options.query.trim()) {
      const searchTerm = `%${options.query.trim()}%`
      query += ' AND (name LIKE ? OR description LIKE ?)'
      binds.push(searchTerm, searchTerm)
    }

    // Sorting
    const sort = options?.sort || 'relevance'
    if (sort === 'relevance') {
      if (options?.query && options.query.trim()) {
        // For relevance with query: prioritize prefix matches, then contains
        // SQLite relevance: order by name starting with query first, then name containing, then description
        const searchTerm = options.query.trim().toLowerCase()
        const prefixTerm = `${searchTerm}%`
        query += ` ORDER BY 
          CASE WHEN LOWER(name) LIKE ? THEN 0 ELSE 1 END,
          CASE WHEN LOWER(name) LIKE ? THEN 0 ELSE 1 END,
          sort_order ASC, 
          created_at DESC`
        binds.push(prefixTerm, `%${searchTerm}%`)
      } else {
        // No query: default to newest
        query += ' ORDER BY created_at DESC, sort_order ASC'
      }
    } else if (sort === 'price_asc') {
      query += ' ORDER BY price ASC, sort_order ASC, created_at DESC'
    } else if (sort === 'price_desc') {
      query += ' ORDER BY price DESC, sort_order ASC, created_at DESC'
    } else if (sort === 'newest') {
      query += ' ORDER BY created_at DESC, sort_order ASC'
    } else {
      // Fallback to default
      query += ' ORDER BY sort_order ASC, created_at DESC'
    }

    if (options?.limit) {
      query += ' LIMIT ?'
      binds.push(options.limit)
    }

    if (options?.offset) {
      query += ' OFFSET ?'
      binds.push(options.offset)
    }

    const result = await this.db.prepare(query).bind(...binds).all<Product>()
    return result.results || []
  }

  async create(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
    const createdAt = Math.floor(Date.now() / 1000)

    const result = await this.db
      .prepare(
        'INSERT INTO products (name, description, images, price, stock, category_id, is_active, min_quantity, max_quantity, product_type, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        product.name,
        product.description || null,
        product.images || null,
        product.price,
        product.stock ?? null,
        product.categoryId,
        product.isActive,
        product.minQuantity,
        product.maxQuantity ?? null,
        product.productType,
        product.sortOrder,
        createdAt
      )
      .run()

    const id = result.meta.last_row_id
    if (!id) {
      throw new Error('Failed to create product')
    }

    return {
      id: Number(id),
      ...product,
      createdAt,
    }
  }

  async update(id: number, updates: Partial<Product>): Promise<Product> {
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error('Product not found')
    }

    const updated: Product = { ...existing, ...updates }

    await this.db
      .prepare(
        'UPDATE products SET name = ?, description = ?, images = ?, price = ?, stock = ?, category_id = ?, is_active = ?, min_quantity = ?, max_quantity = ?, product_type = ?, sort_order = ? WHERE id = ?'
      )
      .bind(
        updated.name,
        updated.description || null,
        updated.images || null,
        updated.price,
        updated.stock ?? null,
        updated.categoryId,
        updated.isActive,
        updated.minQuantity,
        updated.maxQuantity ?? null,
        updated.productType,
        updated.sortOrder,
        id
      )
      .run()

    return updated
  }

  async delete(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  }

  async checkStock(productId: number, quantity: number): Promise<boolean> {
    const product = await this.getById(productId)
    if (!product) {
      return false
    }

    // If stock is null, it's unlimited
    if (product.stock === null) {
      return true
    }

    return product.stock >= quantity
  }
}
