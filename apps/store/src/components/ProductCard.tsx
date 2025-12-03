import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Product } from '@dragon/core'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const price = (product.price / 100).toFixed(2)
  
  let imageUrl = '/placeholder-product.jpg'
  if (product.images) {
    try {
      const images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images
      if (Array.isArray(images) && images.length > 0) {
        imageUrl = images[0]
      } else if (typeof images === 'string') {
        imageUrl = images
      }
    } catch {
      if (typeof product.images === 'string') {
        imageUrl = product.images
      }
    }
  }

  return (
    <div className="fui-goods-item bg-white rounded-lg overflow-hidden shadow-sm">
      <Link href={`/products/${product.id}`} className="flex">
        <div className="image w-32 h-32 flex-shrink-0 bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="detail flex-1 p-3 flex flex-col justify-between">
          <div>
            <div className="name text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
              {product.name}
            </div>
            <div className="sale text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
              {product.description || 'No description available'}
            </div>
          </div>
          <div className="price flex items-center justify-between">
            <div>
              <div className="minprice text-xs text-gray-500 dark:text-gray-400">Price</div>
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                ${price}
              </div>
            </div>
            <Link href={`/products/${product.id}`}>
              <div className="buy bg-[#1492fb] text-white text-xs px-4 py-2 rounded cursor-pointer hover:bg-[#0d7ed8] transition-colors">
                Buy
              </div>
            </Link>
          </div>
        </div>
      </Link>
    </div>
  )
}
