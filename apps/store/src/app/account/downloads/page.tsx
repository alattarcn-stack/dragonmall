'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Download {
  id: number
  orderId: number
  productId: number
  productName: string
  downloadUrl: string
  downloadCount: number
  maxDownloads?: number | null
  expiresAt?: number | null
  orderDate: number | null
  orderStatus: string
}

export default function DownloadsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [downloads, setDownloads] = useState<Download[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    if (user) {
      fetchDownloads()
    }
  }, [user, authLoading, router])

  const fetchDownloads = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/downloads/mine`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch downloads')
      }

      const data = await response.json()
      setDownloads(data.data || [])
    } catch (error) {
      console.error('Error fetching downloads:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const isExpired = (expiresAt: number | null | undefined) => {
    if (!expiresAt) return false
    return expiresAt < Math.floor(Date.now() / 1000)
  }

  const canDownload = (download: Download) => {
    if (isExpired(download.expiresAt)) return false
    if (download.maxDownloads && download.downloadCount >= download.maxDownloads) return false
    return true
  }

  const handleDownload = (download: Download) => {
    if (canDownload(download)) {
      window.open(download.downloadUrl, '_blank')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>My Downloads</CardTitle>
            <CardDescription>Access your digital product downloads</CardDescription>
          </CardHeader>
          <CardContent>
            {downloads.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No downloads available</p>
                <Button asChild className="mt-4">
                  <Link href="/products">Browse Products</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Downloads</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downloads.map((download) => (
                    <TableRow key={download.id}>
                      <TableCell className="font-medium">{download.productName}</TableCell>
                      <TableCell>{formatDate(download.orderDate)}</TableCell>
                      <TableCell>
                        {download.downloadCount}
                        {download.maxDownloads && ` / ${download.maxDownloads}`}
                      </TableCell>
                      <TableCell>
                        {download.expiresAt ? formatDate(download.expiresAt) : 'Never'}
                        {isExpired(download.expiresAt) && (
                          <span className="ml-2 text-red-600 text-xs">(Expired)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleDownload(download)}
                          disabled={!canDownload(download)}
                        >
                          {canDownload(download) ? 'Download' : 'Unavailable'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

