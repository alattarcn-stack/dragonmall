import { Hono } from 'hono'
import type { Env } from '../types'
import { ProductService, CategoryService } from '@dragon/core'
import { ProductListQuerySchema } from '../validation/schemas'
import { makeError, ErrorCodes } from '../utils/errors'

export function createProductsRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const productService = new ProductService(env.D1_DATABASE)
  const categoryService = new CategoryService(env.D1_DATABASE)

  // List products (public)
  router.get('/', async (c) => {
    try {
      // Parse and validate query parameters
      const queryParams = {
        categoryId: c.req.query('categoryId'),
        categorySlug: c.req.query('categorySlug'),
        productType: c.req.query('productType'),
        query: c.req.query('query'),
        sort: c.req.query('sort') || 'relevance',
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
      }

      const validationResult = ProductListQuerySchema.safeParse(queryParams)
      
      // Use validated values or defaults
      const validated = validationResult.success 
        ? validationResult.data 
        : {
            categoryId: queryParams.categoryId ? parseInt(queryParams.categoryId, 10) : undefined,
            categorySlug: queryParams.categorySlug,
            productType: queryParams.productType as 'digital' | 'license_code' | undefined,
            query: queryParams.query,
            sort: (['relevance', 'price_asc', 'price_desc', 'newest'].includes(queryParams.sort || '') 
              ? queryParams.sort 
              : 'relevance') as 'relevance' | 'price_asc' | 'price_desc' | 'newest',
            limit: queryParams.limit ? parseInt(queryParams.limit, 10) : undefined,
            offset: queryParams.offset ? parseInt(queryParams.offset, 10) : undefined,
          }

      // Resolve categorySlug to categoryId if provided
      let resolvedCategoryId: number | undefined = undefined
      if (validated.categorySlug) {
        const category = await categoryService.getCategoryBySlug(validated.categorySlug)
        if (!category || category.isActive === 0) {
          // If category not found or inactive, return empty results
          return c.json({ data: [] })
        }
        resolvedCategoryId = category.id
      } else if (validated.categoryId) {
        resolvedCategoryId = validated.categoryId
      }

      const products = await productService.listProducts({
        categoryId: resolvedCategoryId,
        isActive: true, // Only show active products
        productType: validated.productType,
        query: validated.query,
        sort: validated.sort,
        limit: validated.limit,
        offset: validated.offset,
      })

      return c.json({ data: products })
    } catch (error) {
      console.error('Error listing products:', error)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to list products'), 500)
    }
  })

  // Get product by slug/ID (public)
  router.get('/:slug', async (c) => {
    try {
      const slug = c.req.param('slug')
      const product = await productService.getBySlug(slug)

      if (!product) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Product not found'), 404)
      }

      if (!product.isActive) {
        return c.json(makeError(ErrorCodes.NOT_FOUND, 'Product not available'), 404)
      }

      return c.json({ data: product })
    } catch (error) {
      console.error('Error getting product:', error)
      return c.json(makeError(ErrorCodes.INTERNAL_ERROR, 'Failed to get product'), 500)
    }
  })

  return router
}

