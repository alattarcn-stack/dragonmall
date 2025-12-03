import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getOrder } from '@dragon/api'
import { CheckoutForm } from '@/components/CheckoutForm'

interface CheckoutPageProps {
  params: {
    orderId: string
  }
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const orderId = parseInt(params.orderId, 10)

  if (isNaN(orderId)) {
    redirect('/products')
  }

  const order = await getOrder(orderId)

  if (!order) {
    redirect('/products')
  }

  const total = (order.amount / 100).toFixed(2)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                <span>{order.quantity}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span>${total}</span>
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Order ID: {order.id}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Status: {order.status}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckoutForm orderId={orderId} amount={order.amount} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

