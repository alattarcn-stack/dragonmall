'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StripeCheckout } from './StripeCheckout'

interface CheckoutFormProps {
  orderId: number
  amount: number
}

export function CheckoutForm({ orderId, amount }: CheckoutFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | null>(null)

  const total = (amount / 100).toFixed(2)

  if (!paymentMethod) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Total Amount
          </p>
          <p className="text-2xl font-bold">${total}</p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => setPaymentMethod('stripe')}
            className="w-full"
            size="lg"
          >
            Pay with Stripe (Credit Card, Apple Pay, Google Pay)
          </Button>

          <Button
            onClick={() => setPaymentMethod('paypal')}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Pay with PayPal
          </Button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Secure payment processing
        </p>
      </div>
    )
  }

  if (paymentMethod === 'stripe') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Stripe Payment</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaymentMethod(null)}
          >
            Change Method
          </Button>
        </div>
        <StripeCheckout orderId={orderId} amount={amount} />
      </div>
    )
  }

  if (paymentMethod === 'paypal') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">PayPal Payment</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaymentMethod(null)}
          >
            Change Method
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            PayPal integration coming soon
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              // TODO: Implement PayPal order creation
              try {
                const response = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/payments/paypal/create-order`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Requested-With': 'XMLHttpRequest', // CSRF protection
                    },
                    body: JSON.stringify({ orderId }),
                  }
                )

                if (!response.ok) {
                  throw new Error('Failed to create PayPal order')
                }

                const data = await response.json()
                // Redirect to PayPal approval URL
                if (data.data?.approvalUrl) {
                  window.location.href = data.data.approvalUrl
                }
              } catch (error: any) {
                alert(`PayPal error: ${error.message}`)
              }
            }}
          >
            Continue with PayPal
          </Button>
        </div>
      </div>
    )
  }

  return null
}
