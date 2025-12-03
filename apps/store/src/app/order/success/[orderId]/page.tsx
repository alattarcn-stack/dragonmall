import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getOrder } from '@dragon/api'
import { OrderSuccessContent } from '@/components/OrderSuccessContent'

interface OrderSuccessPageProps {
  params: {
    orderId: string
  }
}

export default async function OrderSuccessPage({ params }: OrderSuccessPageProps) {
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
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-2">Order Successful!</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Thank you for your purchase. Your order has been processed.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Order ID:</span>
            <span className="font-mono">#{order.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Status:</span>
            <span className="capitalize">{order.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
            <span>{order.quantity}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold pt-4 border-t">
            <span>Total:</span>
            <span>${total}</span>
          </div>
        </CardContent>
      </Card>

      <OrderSuccessContent order={order} />

      <div className="text-center mt-8">
        <Button asChild variant="outline">
          <Link href="/products">Continue Shopping</Link>
        </Button>
      </div>
    </div>
  )
}

