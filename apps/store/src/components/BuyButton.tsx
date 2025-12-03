'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createDraftOrder } from '@dragon/api'
import type { Product } from '@dragon/core'

interface BuyButtonProps {
  product: Product
}

export function BuyButton({ product }: BuyButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(product.minQuantity)
  const [email, setEmail] = useState('')

  useEffect(() => {
    // Get email from input field
    const emailInput = document.getElementById('customer_email') as HTMLInputElement
    if (emailInput) {
      const checkEmail = () => {
        setEmail(emailInput.value)
      }
      emailInput.addEventListener('input', checkEmail)
      return () => emailInput.removeEventListener('input', checkEmail)
    }
  }, [])

  useEffect(() => {
    // Handle quantity changes
    const numInput = document.getElementById('num') as HTMLInputElement
    const numMin = document.getElementById('num_min')
    const numAdd = document.getElementById('num_add')

    if (numInput && numMin && numAdd) {
      const updateQuantity = (delta: number) => {
        const current = parseInt(numInput.value) || product.minQuantity
        const min = product.minQuantity
        const max = product.maxQuantity || (product.stock || 999)
        const newValue = Math.max(min, Math.min(max, current + delta))
        numInput.value = newValue.toString()
        setQuantity(newValue)
      }

      numMin.onclick = () => updateQuantity(-1)
      numAdd.onclick = () => updateQuantity(1)
      numInput.oninput = () => {
        const value = parseInt(numInput.value) || product.minQuantity
        setQuantity(value)
      }
    }
  }, [product])

  const handleBuy = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get email from input
      const emailInput = document.getElementById('customer_email') as HTMLInputElement
      const customerEmail = emailInput?.value || email

      if (!customerEmail) {
        setError('Please enter your email address')
        setLoading(false)
        return
      }

      // Validate email
      if (!customerEmail.includes('@')) {
        setError('Please enter a valid email address')
        setLoading(false)
        return
      }

      // Get quantity
      const numInput = document.getElementById('num') as HTMLInputElement
      const qty = numInput ? parseInt(numInput.value) || quantity : quantity

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

      // Create draft order
      const order = await createDraftOrder(
        product.id,
        qty,
        customerEmail
      )

      // Redirect to checkout
      router.push(`/checkout/${order.id}`)
    } catch (err: any) {
      console.error('Error creating order:', err)
      setError(err.message || 'Failed to create order. Please try again.')
      setLoading(false)
    }
  }

  const price = (product.price / 100).toFixed(2)

  return (
    <button
      onClick={handleBuy}
      disabled={loading}
      className="aui-btn aui-btn-red w-full h-14 text-white font-bold text-sm rounded-none"
      style={{
        backgroundImage: 'linear-gradient(to right, rgb(255, 119, 0), rgb(255, 73, 0))'
      }}
    >
      {loading ? 'Processing...' : `Buy Now - $${price}`}
      {error && (
        <div className="absolute top-full left-0 right-0 bg-red-100 text-red-600 text-xs p-2 mt-1">
          {error}
        </div>
      )}
    </button>
  )
}
