import type { D1Database } from '@cloudflare/workers-types'
import type { Category } from '../types'

export class CategoryService {
  constructor(private db: D1Database) {}

  /**
   * List all categories
   */
  async listCategories(options?: { includeInactive?: boolean }): Promise<Category[]> {
    let query = 'SELECT * FROM categories'
    const params: any[] = []

    if (!options?.includeInactive) {
      query += ' WHERE is_active = ?'
      params.push(1)
    }

    query += ' ORDER BY sort_order ASC, name ASC'

    const result = await this.db.prepare(query).bind(...params).all<{
      id: number
      name: string
      slug: string
      description: string | null
      sort_order: number
      is_active: number
      created_at: number
      updated_at: number
    }>()

    return (result.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: number): Promise<Category | null> {
    const result = await this.db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .bind(id)
      .first<{
        id: number
        name: string
        slug: string
        description: string | null
        sort_order: number
        is_active: number
        created_at: number
        updated_at: number
      }>()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      name: result.name,
      slug: result.slug,
      description: result.description,
      sortOrder: result.sort_order,
      isActive: result.is_active,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const result = await this.db
      .prepare('SELECT * FROM categories WHERE slug = ?')
      .bind(slug)
      .first<{
        id: number
        name: string
        slug: string
        description: string | null
        sort_order: number
        is_active: number
        created_at: number
        updated_at: number
      }>()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      name: result.name,
      slug: result.slug,
      description: result.description,
      sortOrder: result.sort_order,
      isActive: result.is_active,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  }

  /**
   * Create a new category
   */
  async createCategory(input: {
    name: string
    slug: string
    description?: string | null
    sortOrder?: number
    isActive?: boolean
  }): Promise<Category> {
    const now = Math.floor(Date.now() / 1000)
    const sortOrder = input.sortOrder ?? 10
    const isActive = input.isActive !== false ? 1 : 0

    const result = await this.db
      .prepare(
        'INSERT INTO categories (name, slug, description, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(input.name, input.slug, input.description || null, sortOrder, isActive, now, now)
      .run()

    const id = result.meta.last_row_id
    if (!id) {
      throw new Error('Failed to create category')
    }

    const category = await this.getCategoryById(Number(id))
    if (!category) {
      throw new Error('Failed to retrieve created category')
    }

    return category
  }

  /**
   * Update a category
   */
  async updateCategory(
    id: number,
    input: Partial<{
      name: string
      slug: string
      description: string | null
      sortOrder: number
      isActive: boolean
    }>
  ): Promise<Category> {
    // Get existing category
    const existing = await this.getCategoryById(id)
    if (!existing) {
      throw new Error('Category not found')
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    if (input.slug !== undefined) {
      updates.push('slug = ?')
      values.push(input.slug)
    }
    if (input.description !== undefined) {
      updates.push('description = ?')
      values.push(input.description)
    }
    if (input.sortOrder !== undefined) {
      updates.push('sort_order = ?')
      values.push(input.sortOrder)
    }
    if (input.isActive !== undefined) {
      updates.push('is_active = ?')
      values.push(input.isActive ? 1 : 0)
    }

    if (updates.length === 0) {
      return existing
    }

    // Always update updated_at
    updates.push('updated_at = ?')
    values.push(Math.floor(Date.now() / 1000))
    values.push(id)

    await this.db
      .prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()

    const updated = await this.getCategoryById(id)
    if (!updated) {
      throw new Error('Failed to retrieve updated category')
    }

    return updated
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: number): Promise<void> {
    // Check if any products reference this category
    const productsCount = await this.db
      .prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?')
      .bind(id)
      .first<{ count: number }>()

    if (productsCount && productsCount.count > 0) {
      throw new Error(`Cannot delete category: ${productsCount.count} product(s) are using this category`)
    }

    const result = await this.db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()

    if (result.meta.changes === 0) {
      throw new Error('Category not found')
    }
  }
}

