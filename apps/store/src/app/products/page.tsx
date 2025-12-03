'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ProductCard } from '@/components/ProductCard'
import { getProducts, getCategories } from '@dragon/api'
import type { Product } from '@dragon/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

interface Category {
  id: number
  name: string
  slug: string
  sortOrder: number
}

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest'

function ProductsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const categorySlug = searchParams.get('categorySlug')
  const queryParam = searchParams.get('query') || ''
  const sortParam = (searchParams.get('sort') as SortOption) || 'relevance'

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(queryParam)
  const [sort, setSort] = useState<SortOption>(sortParam)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categorySlug)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    setSelectedCategory(categorySlug)
    setSearchQuery(queryParam)
    setSort(sortParam)
    fetchProducts()
  }, [categorySlug, queryParam, sortParam])

  const fetchCategories = async () => {
    try {
      const cats = await getCategories()
      setCategories(cats)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const prods = await getProducts({
        categorySlug: categorySlug || undefined,
        query: queryParam || undefined,
        sort: sortParam,
      })
      setProducts(prods)
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const updateURL = (updates: { categorySlug?: string | null; query?: string; sort?: SortOption }) => {
    const params = new URLSearchParams()
    
    if (updates.categorySlug) {
      params.set('categorySlug', updates.categorySlug)
    } else if (updates.categorySlug === null) {
      // Explicitly clear category
    }
    
    if (updates.query) {
      params.set('query', updates.query)
    }
    
    if (updates.sort && updates.sort !== 'relevance') {
      params.set('sort', updates.sort)
    }
    
    const queryString = params.toString()
    router.push(`/products${queryString ? `?${queryString}` : ''}`)
  }

  const handleCategoryClick = (slug: string | null) => {
    setSelectedCategory(slug)
    updateURL({ categorySlug: slug, query: queryParam, sort })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateURL({ categorySlug, query: searchQuery, sort })
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value as SortOption
    setSort(newSort)
    updateURL({ categorySlug, query: queryParam, sort: newSort })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">All Products</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Browse our collection of digital products and license codes
        </p>
      </div>

      {/* Search and Sort Controls */}
      <div className="mb-6 space-y-4">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </form>

        {/* Sort and Category Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sort by:
            </label>
            <Select
              id="sort"
              value={sort}
              onChange={handleSortChange}
              className="w-48"
            >
              <option value="relevance">Relevance (default)</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest</option>
            </Select>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleCategoryClick(null)}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.slug ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCategoryClick(category.slug)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">Loading products...</p>
        </div>
      ) : products.length > 0 ? (
        <div className="fui-goods-group space-y-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {selectedCategory ? 'No products in this category yet.' : 'No products available yet. Check back soon!'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">Loading...</p>
        </div>
      </div>
    }>
      <ProductsPageContent />
    </Suspense>
  )
}
