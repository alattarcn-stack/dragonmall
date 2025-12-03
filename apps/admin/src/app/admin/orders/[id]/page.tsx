'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { getAdminOrder, refundOrder } from '@dragon/api'
import type { Order, Payment, Refund } from '@dragon/core'

interface OrderWithPayment extends Order {
  payment?: Payment
  refunds?: Refund[]
}

export default function OrderDetailPage() {
  const params = useParams()
  const orderId = parseInt(params.id as string, 10)
  const [order, setOrder] = useState<OrderWithPayment | null>(null)
  const [loading, setLoading] = useState(true)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refunding, setRefunding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      fetchOrder()
    }
  }, [orderId])

  const fetchOrder = async () => {
    try {
      const data = await getAdminOrder(orderId)
      setOrder(data)
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefund = async () => {
    if (!order) return

    setRefunding(true)
    setError(null)

    try {
      const result = await refundOrder(orderId, refundReason || undefined)
      setOrder({
        ...result.order,
        payment: result.payment,
        refunds: result.payment ? [result.refund] : [],
      })
      setRefundDialogOpen(false)
      setRefundReason('')
    } catch (err: any) {
      console.error('Error refunding order:', err)
      setError(err.message || 'Failed to process refund')
    } finally {
      setRefunding(false)
    }
  }

  const canRefund = () => {
    if (!order || !order.payment) return false
    if (order.status !== 'completed' && order.status !== 'processing') return false
    if (order.payment.status === 'refunded') return false
    const hasSuccessfulRefund = order.refunds?.some((r) => r.status === 'succeeded')
    return !hasSuccessfulRefund
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!order) {
    return <div className="text-center py-8">Order not found</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Order #{order.id}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Customer Email</label>
              <p className="mt-1">{order.customerEmail}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Quantity</label>
                <p className="mt-1">{order.quantity}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Amount</label>
                <p className="mt-1 text-lg font-semibold">${((order.amount || 0) / 100).toFixed(2)}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <p className="mt-1">
                <span className={`px-2 py-1 rounded text-xs ${
                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
                  order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  order.status === 'refunded' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {order.status}
                </span>
              </p>
            </div>
            {order.payment && (
              <div>
                <label className="text-sm font-medium text-gray-500">Payment Status</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs ${
                    order.payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                    order.payment.status === 'refunded' ? 'bg-orange-100 text-orange-800' :
                    order.payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.payment.status}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {order.payment.method.toUpperCase()} • {order.payment.currency.toUpperCase()}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Created At</label>
              <p className="mt-1">
                {new Date((order.createdAt || 0) * 1000).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {order.fulfillmentResult && (
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded">
                {order.fulfillmentResult}
              </pre>
            </CardContent>
          </Card>
        )}

        {order.payment && (
          <Card>
            <CardHeader>
              <CardTitle>Payment & Refunds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Payment Method</label>
                <p className="mt-1">{order.payment.method.toUpperCase()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Transaction Number</label>
                <p className="mt-1 font-mono text-sm">{order.payment.transactionNumber}</p>
              </div>
              {order.payment.externalTransactionId && (
                <div>
                  <label className="text-sm font-medium text-gray-500">External Transaction ID</label>
                  <p className="mt-1 font-mono text-sm">{order.payment.externalTransactionId}</p>
                </div>
              )}
              {order.refunds && order.refunds.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Refunds</label>
                  <div className="mt-2 space-y-2">
                    {order.refunds.map((refund) => (
                      <div key={refund.id} className="border rounded p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">${(refund.amount / 100).toFixed(2)} {refund.currency.toUpperCase()}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(refund.createdAt * 1000).toLocaleString()}
                            </p>
                            {refund.reason && (
                              <p className="text-sm text-gray-600 mt-1">{refund.reason}</p>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            refund.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                            refund.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {refund.status}
                          </span>
                        </div>
                        {refund.providerRefundId && (
                          <p className="text-xs text-gray-500 mt-2 font-mono">
                            Provider ID: {refund.providerRefundId}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {canRefund() && (
                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => setRefundDialogOpen(true)}
                  >
                    Refund Order
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to refund the full amount (${((order?.totalAmount ?? order?.amount ?? 0) / 100).toFixed(2)}) for this order?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Refund Reason (optional)</label>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason for refund..."
                rows={3}
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)} disabled={refunding}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRefund} disabled={refunding}>
              {refunding ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

