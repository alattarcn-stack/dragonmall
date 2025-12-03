import { apiClient } from './client'
import type { Product } from '@dragon/core'

export async function getProducts(options?: {
  categoryId?: number
  categorySlug?: string
  productType?: 'digital' | 'license_code'
  query?: string
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest'
  limit?: number
  offset?: number
}): Promise<Product[]> {
  const params = new URLSearchParams()
  
  if (options?.categorySlug) {
    params.append('categorySlug', options.categorySlug)
  } else if (options?.categoryId) {
    params.append('categoryId', options.categoryId.toString())
  }
  if (options?.productType) {
    params.append('productType', options.productType)
  }
  if (options?.query) {
    params.append('query', options.query)
  }
  if (options?.sort) {
    params.append('sort', options.sort)
  }
  if (options?.limit) {
    params.append('limit', options.limit.toString())
  }
  if (options?.offset) {
    params.append('offset', options.offset.toString())
  }

  const query = params.toString()
  const endpoint = `/api/products${query ? `?${query}` : ''}`
  
  const response = await apiClient.get<{ data: Product[] }>(endpoint)
  return response.data.data || []
}

export async function getCategories(): Promise<Array<{ id: number; name: string; slug: string; sortOrder: number }>> {
  const response = await apiClient.get<{ data: Array<{ id: number; name: string; slug: string; sortOrder: number }> }>('/api/categories')
  return response.data.data || []
}

export async function getProduct(slug: string): Promise<Product | null> {
  try {
    const response = await apiClient.get<{ data: Product }>(`/api/products/${slug}`)
    return response.data.data || null
  } catch (error: any) {
    if (error.code === 'NOT_FOUND' || error.message?.includes('404')) {
      return null
    }
    throw error
  }
}

