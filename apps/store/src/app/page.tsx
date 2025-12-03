import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/ProductCard'
import { getProducts } from '@dragon/api'
import type { Product } from '@dragon/core'

// Force dynamic rendering to avoid build-time API calls
export const dynamic = 'force-dynamic'

async function getFeaturedProducts(): Promise<Product[]> {
  try {
    return await getProducts({ limit: 6 })
  } catch (error) {
    console.error('Error fetching products:', error)
    return []
  }
}

export default async function Home() {
  const products = await getFeaturedProducts()

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dragon Station 2026
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Premium Digital Products & License Codes
            </p>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Fast, secure, and modern platform for digital goods. Built on Cloudflare's global edge network.
            </p>
            <div className="flex gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/products">Browse Products</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      {products.length > 0 && (
        <section className="max-w-[650px] mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Featured Products</h2>
            <Button variant="outline" asChild size="sm">
              <Link href="/products">View All</Link>
            </Button>
          </div>
          <div className="fui-goods-group space-y-2">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {products.length === 0 && (
        <section className="container mx-auto px-4 py-16">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No products available yet. Check back soon!
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
