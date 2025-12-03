import { Hono } from 'hono'
import type { Env } from '../types'
import { CategoryService } from '@dragon/core'
import { makeError, ErrorCodes } from '../utils/errors'

export function createCategoriesRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const categoryService = new CategoryService(env.D1_DATABASE)

  // GET /api/categories - Public endpoint for active categories
  router.get('/', async (c) => {
    try {
      const categories = await categoryService.listCategories({ includeInactive: false })
      
      // Return only basic fields for public API
      const publicCategories = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
      }))

      return c.json({ data: publicCategories })
    } catch (error) {
      console.error('Error listing categories:', error)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to list categories'), 500)
    }
  })

  return router
}

