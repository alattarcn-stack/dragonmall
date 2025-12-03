'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'

interface StripeCheckoutProps {
  orderId: number
  amount: number
  currency?: string
}

// Initialize Stripe
const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
}

const stripePromise = loadStripe(getStripePublishableKey())

function CheckoutForm({ orderId, amount, currency = 'usd' }: StripeCheckoutProps) {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    // Create payment intent
    const createPaymentIntent = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/payments/stripe/create-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest', // CSRF protection
          },
          body: JSON.stringify({
            orderId,
            currency,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create payment intent')
        }

        const data = await response.json()
        setClientSecret(data.data.clientSecret)
      } catch (err: any) {
        setError(err.message || 'Failed to initialize payment')
      }
    }

    createPaymentIntent()
  }, [orderId, currency])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setLoading(true)
    setError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message || 'Payment form error')
      setLoading(false)
      return
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/order/success/${orderId}`,
      },
    })

    if (confirmError) {
      setError(confirmError.message || 'Payment failed')
      setLoading(false)
    } else {
      // Redirect will happen automatically via return_url
    }
  }

  if (!clientSecret) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Initializing payment...</p>
      </div>
    )
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="text-red-600 text-sm mt-2">{error}</div>
      )}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full"
        size="lg"
      >
        {loading ? 'Processing...' : `Pay $${(amount / 100).toFixed(2)}`}
      </Button>
    </form>
  )
}

export function StripeCheckout({ orderId, amount, currency = 'usd' }: StripeCheckoutProps) {
  const stripePublishableKey = getStripePublishableKey()

  if (!stripePublishableKey) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Stripe is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.</p>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: undefined }}>
      <CheckoutForm orderId={orderId} amount={amount} currency={currency} />
    </Elements>
  )
}

