'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Order } from '@dragon/core'

interface OrderSuccessContentProps {
  order: Order
}

export function OrderSuccessContent({ order }: OrderSuccessContentProps) {
  // Parse fulfillment result
  const fulfillmentResult = order.fulfillmentResult || ''

  // Check if it's license codes (contains newlines or colons)
  const isLicenseCodes = fulfillmentResult.includes('\n') || fulfillmentResult.includes(':')

  // Check if it's a download link
  const isDownloadLink = fulfillmentResult.startsWith('http') || fulfillmentResult.startsWith('/api/downloads')

  return (
    <div className="space-y-4">
      {order.status === 'completed' && order.fulfillmentResult && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isLicenseCodes ? 'License Codes' : isDownloadLink ? 'Download' : 'Order Details'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLicenseCodes ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Your license codes are ready. Please save them securely:
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap break-all">
                  {fulfillmentResult}
                </div>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(fulfillmentResult)
                    alert('License codes copied to clipboard!')
                  }}
                  variant="outline"
                  className="w-full mt-4"
                >
                  Copy to Clipboard
                </Button>
              </div>
            ) : isDownloadLink ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your download is ready:
                </p>
                <Button asChild className="w-full">
                  <a href={fulfillmentResult} download>
                    Download Now
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {fulfillmentResult}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {order.status !== 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle>Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your order is being processed. You will receive an email with your purchase details once it's complete.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

