'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminProduct, uploadProductFile } from '@dragon/api'
import type { Product } from '@dragon/core'

export default function ProductDetailPage() {
  const params = useParams()
  const productId = parseInt(params.id as string, 10)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (productId) {
      fetchProduct()
    }
  }, [productId])

  const fetchProduct = async () => {
    try {
      const data = await getAdminProduct(productId)
      setProduct(data)
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await uploadProductFile(productId, file)
      alert('File uploaded successfully')
    } catch (error: any) {
      alert(`Error uploading file: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!product) {
    return <div className="text-center py-8">Product not found</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{product.name}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Description</label>
              <p className="mt-1">{product.description || 'No description'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Price</label>
                <p className="mt-1 text-lg font-semibold">${(product.price / 100).toFixed(2)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Type</label>
                <p className="mt-1">{product.productType}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Stock</label>
                <p className="mt-1">{product.stock ?? 'Unlimited'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs ${
                    product.isActive === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {product.isActive === 1 ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {product.productType === 'digital' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Digital File</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select File</label>
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </div>
                {uploading && (
                  <p className="text-sm text-gray-500">Uploading...</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

