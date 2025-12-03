'use client'

import { useState } from 'react'
import { useCart } from '@/hooks/useCart'
import type { Product } from '@dragon/core'

interface AddToCartButtonProps {
  product: Product
  quantity?: number
  className?: string
}

export function AddToCartButton({ product, quantity, className }: AddToCartButtonProps) {
  const { addToCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleAddToCart = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Get quantity from input if not provided
      let qty = quantity
      if (!qty) {
        const numInput = document.getElementById('num') as HTMLInputElement
        qty = numInput ? parseInt(numInput.value) || product.minQuantity : product.minQuantity
      }

      // Validate quantity
      if (qty < product.minQuantity) {
        setError(`Minimum quantity is ${product.minQuantity}`)
        setLoading(false)
        return
      }

      if (product.maxQuantity && qty > product.maxQuantity) {
        setError(`Maximum quantity is ${product.maxQuantity}`)
        setLoading(false)
        return
      }

      if (product.stock !== null && qty > product.stock) {
        setError(`Only ${product.stock} items available`)
        setLoading(false)
        return
      }

      await addToCart(product.id, qty)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      console.error('Error adding to cart:', err)
      setError(err.message || 'Failed to add to cart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleAddToCart}
        disabled={loading || (product.stock !== null && product.stock === 0)}
        className={className || "w-full h-14 text-white font-bold text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"}
      >
        {loading ? 'Adding...' : success ? 'Added to Cart!' : 'Add to Cart'}
      </button>
      {error && (
        <div className="absolute top-full left-0 right-0 bg-red-100 text-red-600 text-xs p-2 mt-1 rounded">
          {error}
        </div>
      )}
    </div>
  )
}

