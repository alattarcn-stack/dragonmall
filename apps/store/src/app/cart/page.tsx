'use client'

import { useRouter } from 'next/navigation'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

export default function CartPage() {
  const router = useRouter()
  const { cart, isLoading, updateItemQuantity, removeItem, checkout, refreshCart } = useCart()
  const { user } = useAuth()
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [applyingCoupon, setApplyingCoupon] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [removingCoupon, setRemovingCoupon] = useState(false)

  const handleCheckout = async () => {
    if (!cart || cart.items.length === 0) {
      setError('Cart is empty')
      return
    }

    setCheckingOut(true)
    setError(null)

    try {
      // For guest users, we need email (will be handled in checkout page)
      const orderId = await checkout()
      router.push(`/checkout/${orderId}`)
    } catch (err: any) {
      console.error('Checkout error:', err)
      setError(err.message || 'Failed to checkout')
      setCheckingOut(false)
    }
  }

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      await removeItem(itemId)
    } else {
      await updateItemQuantity(itemId, newQuantity)
    }
  }

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!couponCode.trim()) return

    setApplyingCoupon(true)
    setCouponError(null)

    try {
      const response = await fetch(`${apiUrl}/api/cart/apply-coupon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ code: couponCode.toUpperCase().trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply coupon')
      }

      setCouponCode('')
      await refreshCart()
    } catch (err: any) {
      console.error('Error applying coupon:', err)
      setCouponError(err.message || 'Failed to apply coupon')
    } finally {
      setApplyingCoupon(false)
    }
  }

  const handleRemoveCoupon = async () => {
    setRemovingCoupon(true)
    setCouponError(null)

    try {
      const response = await fetch(`${apiUrl}/api/cart/remove-coupon`, {
        method: 'DELETE',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove coupon')
      }

      await refreshCart()
    } catch (err: any) {
      console.error('Error removing coupon:', err)
      setCouponError(err.message || 'Failed to remove coupon')
    } finally {
      setRemovingCoupon(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-[650px] mx-auto bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading cart...</p>
        </div>
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-[650px] mx-auto bg-white min-h-screen">
        <div className="px-4 py-8">
          <h1 className="text-2xl font-bold mb-4">Shopping Cart</h1>
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Your cart is empty</p>
            <Button asChild>
              <Link href="/products">Browse Products</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const subtotal = cart.subtotalAmount ?? cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discount = cart.discountAmount ?? 0
  const total = cart.totalAmount ?? subtotal

  const subtotalFormatted = (subtotal / 100).toFixed(2)
  const discountFormatted = (discount / 100).toFixed(2)
  const totalFormatted = (total / 100).toFixed(2)

  return (
    <div className="max-w-[650px] mx-auto bg-white min-h-screen pb-24">
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Shopping Cart</h1>

        {/* Cart Items */}
        <div className="space-y-4 mb-6">
          {cart.items.map((item) => (
            <div key={item.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{item.productName}</h3>
                  <p className="text-sm text-gray-600">
                    ${(item.price / 100).toFixed(2)} each
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-semibold">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                  >
                    +
                  </Button>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">
                    ${(item.subtotal / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coupon Section */}
        <div className="border rounded-lg p-4 mb-6">
          {cart.couponCode ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-600">Applied Coupon:</p>
                  <p className="font-semibold text-lg">{cart.couponCode}</p>
                  {discount > 0 && (
                    <p className="text-sm text-green-600">-${discountFormatted} discount</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveCoupon}
                  disabled={removingCoupon}
                  className="text-red-600 hover:text-red-700"
                >
                  {removingCoupon ? 'Removing...' : 'Remove'}
                </Button>
              </div>
              {couponError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mt-2 text-sm">
                  {couponError}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium mb-2">Have a coupon?</p>
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <Input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase())
                    setCouponError(null)
                  }}
                  placeholder="Enter coupon code"
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={applyingCoupon || !couponCode.trim()}
                  variant="outline"
                >
                  {applyingCoupon ? 'Applying...' : 'Apply'}
                </Button>
              </form>
              {couponError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mt-2 text-sm">
                  {couponError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart Summary */}
        <div className="border-t pt-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-semibold">Subtotal:</span>
            <span className="text-lg font-semibold">${subtotalFormatted}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between items-center mb-2">
              <span className="text-lg text-green-600">Discount:</span>
              <span className="text-lg font-semibold text-green-600">-${discountFormatted}</span>
            </div>
          )}
          <div className="flex justify-between items-center mb-2 pt-2 border-t">
            <span className="text-lg font-semibold">Total Items:</span>
            <span className="text-lg font-semibold">{cart.totalQuantity}</span>
          </div>
          <div className="flex justify-between items-center mb-4 pt-2 border-t">
            <span className="text-xl font-bold">Total:</span>
            <span className="text-2xl font-bold text-blue-600">${totalFormatted}</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Checkout Button */}
        <Button
          onClick={handleCheckout}
          disabled={checkingOut}
          className="w-full h-14 text-lg font-bold"
          size="lg"
        >
          {checkingOut ? 'Processing...' : 'Proceed to Checkout'}
        </Button>

        {/* Continue Shopping */}
        <div className="text-center mt-4">
          <Link href="/products" className="text-blue-600 hover:text-blue-700">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}

