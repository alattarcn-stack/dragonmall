import { useState, useEffect, useCallback } from 'react'

interface CartItem {
  id: number
  productId: number
  productName: string
  productType: string
  quantity: number
  price: number
  subtotal: number
}

interface Cart {
  id: number
  userId: number | null
  customerEmail: string
  items: CartItem[]
  totalQuantity: number
  subtotalAmount?: number
  discountAmount?: number
  totalAmount: number
  couponCode?: string | null
  createdAt: number
}

interface CartState {
  cart: Cart | null
  isLoading: boolean
  itemCount: number
  refreshCart: () => Promise<void>
  addToCart: (productId: number, quantity?: number) => Promise<void>
  updateItemQuantity: (itemId: number, quantity: number) => Promise<void>
  removeItem: (itemId: number) => Promise<void>
  checkout: (customerEmail?: string) => Promise<number> // Returns orderId
}

export function useCart(): CartState {
  const [cart, setCart] = useState<Cart | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

  const refreshCart = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/cart`, {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setCart(data.data)
      } else {
        setCart(null)
      }
    } catch (error) {
      console.error('Failed to fetch cart:', error)
      setCart(null)
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl])

  useEffect(() => {
    refreshCart()
  }, [refreshCart])

  const addToCart = useCallback(async (productId: number, quantity: number = 1) => {
    try {
      const response = await fetch(`${apiUrl}/api/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add to cart')
      }

      const data = await response.json()
      setCart(data.data)
    } catch (error) {
      console.error('Failed to add to cart:', error)
      throw error
    }
  }, [apiUrl])

  const updateItemQuantity = useCallback(async (itemId: number, quantity: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/cart/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ quantity }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update cart item')
      }

      const data = await response.json()
      setCart(data.data)
    } catch (error) {
      console.error('Failed to update cart item:', error)
      throw error
    }
  }, [apiUrl])

  const removeItem = useCallback(async (itemId: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove cart item')
      }

      const data = await response.json()
      setCart(data.data)
    } catch (error) {
      console.error('Failed to remove cart item:', error)
      throw error
    }
  }, [apiUrl])

  const checkout = useCallback(async (customerEmail?: string): Promise<number> => {
    try {
      const response = await fetch(`${apiUrl}/api/cart/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ customerEmail }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to checkout')
      }

      const data = await response.json()
      setCart(null) // Clear cart after checkout
      return data.data.orderId
    } catch (error) {
      console.error('Failed to checkout:', error)
      throw error
    }
  }, [apiUrl])

  return {
    cart,
    isLoading,
    itemCount: cart?.totalQuantity || 0,
    refreshCart,
    addToCart,
    updateItemQuantity,
    removeItem,
    checkout,
  }
}

