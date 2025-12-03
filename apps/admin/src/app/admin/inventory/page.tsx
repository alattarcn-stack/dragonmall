'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { getInventoryItems, uploadInventoryItems } from '@dragon/api'
import type { InventoryItem } from '@dragon/core'

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [productId, setProductId] = useState('')
  const [csvText, setCsvText] = useState('')

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      const data = await getInventoryItems()
      setItems(data)
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!productId || !csvText.trim()) {
      alert('Please enter product ID and CSV data')
      return
    }

    try {
      // Parse CSV: format: code,password (one per line)
      const lines = csvText.trim().split('\n')
      const parsedItems = lines.map(line => {
        const [code, password] = line.split(',').map(s => s.trim())
        return { licenseCode: code, password: password || undefined }
      }).filter(item => item.licenseCode)

      await uploadInventoryItems(parseInt(productId, 10), parsedItems)
      setDialogOpen(false)
      setCsvText('')
      setProductId('')
      fetchInventory()
      alert(`Successfully added ${parsedItems.length} items`)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const availableCount = items.filter(item => !item.orderId).length
  const usedCount = items.filter(item => item.orderId).length

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Upload License Codes</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload License Codes</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Product ID</label>
                <Input
                  type="number"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  placeholder="Enter product ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  CSV Data (format: code,password - one per line)
                </label>
                <Textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={10}
                  placeholder="ABC123,password1&#10;DEF456,password2&#10;GHI789"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload}>Upload</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Available Codes</h3>
          <p className="text-3xl font-bold">{availableCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Used Codes</h3>
          <p className="text-3xl font-bold">{usedCount}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Product ID</TableHead>
              <TableHead>License Code</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.slice(0, 100).map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.id}</TableCell>
                <TableCell>{item.productId}</TableCell>
                <TableCell className="font-mono text-sm">{item.licenseCode}</TableCell>
                <TableCell className="font-mono text-sm">{item.password || '-'}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.orderId ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.orderId ? 'Used' : 'Available'}
                  </span>
                </TableCell>
                <TableCell>{item.orderId || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

