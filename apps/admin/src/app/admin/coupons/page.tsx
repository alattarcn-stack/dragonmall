'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '@dragon/api'
import type { Coupon } from '@dragon/core'

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    amount: 0,
    currency: '',
    maxUses: '',
    perUserLimit: '',
    minOrderAmount: '',
    startsAt: '',
    endsAt: '',
    isActive: true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Coupon | null>(null)

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      const data = await getCoupons(true)
      setCoupons(data || [])
    } catch (err: any) {
      console.error('Error fetching coupons:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon)
      setFormData({
        code: coupon.code,
        type: coupon.type,
        amount: coupon.amount,
        currency: coupon.currency || '',
        maxUses: coupon.maxUses?.toString() || '',
        perUserLimit: coupon.perUserLimit?.toString() || '',
        minOrderAmount: coupon.minOrderAmount?.toString() || '',
        startsAt: coupon.startsAt ? new Date(coupon.startsAt * 1000).toISOString().slice(0, 16) : '',
        endsAt: coupon.endsAt ? new Date(coupon.endsAt * 1000).toISOString().slice(0, 16) : '',
        isActive: coupon.isActive === 1,
      })
    } else {
      setEditingCoupon(null)
      setFormData({
        code: '',
        type: 'percentage',
        amount: 0,
        currency: '',
        maxUses: '',
        perUserLimit: '',
        minOrderAmount: '',
        startsAt: '',
        endsAt: '',
        isActive: true,
      })
    }
    setError(null)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingCoupon(null)
    setFormData({
      code: '',
      type: 'percentage',
      amount: 0,
      currency: '',
      maxUses: '',
      perUserLimit: '',
      minOrderAmount: '',
      startsAt: '',
      endsAt: '',
      isActive: true,
    })
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        code: formData.code.toUpperCase().trim(),
        type: formData.type,
        amount: formData.amount,
        currency: formData.currency || null,
        maxUses: formData.maxUses ? parseInt(formData.maxUses, 10) : null,
        perUserLimit: formData.perUserLimit ? parseInt(formData.perUserLimit, 10) : null,
        minOrderAmount: formData.minOrderAmount ? parseInt(formData.minOrderAmount, 10) : null,
        startsAt: formData.startsAt ? Math.floor(new Date(formData.startsAt).getTime() / 1000) : null,
        endsAt: formData.endsAt ? Math.floor(new Date(formData.endsAt).getTime() / 1000) : null,
        isActive: formData.isActive,
      }

      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, payload)
      } else {
        await createCoupon(payload)
      }

      await fetchCoupons()
      handleCloseDialog()
    } catch (err: any) {
      console.error('Error saving coupon:', err)
      setError(err.message || 'Failed to save coupon')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await deleteCoupon(deleteConfirm.id)
      await fetchCoupons()
      setDeleteConfirm(null)
    } catch (err: any) {
      console.error('Error deleting coupon:', err)
      setError(err.message || 'Failed to delete coupon')
    }
  }

  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp * 1000).toLocaleString()
  }

  const formatAmount = (coupon: Coupon) => {
    if (coupon.type === 'percentage') {
      return `${coupon.amount}%`
    }
    return `$${(coupon.amount / 100).toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading coupons...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Coupons</h1>
          <p className="text-gray-600 mt-1">Manage discount codes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>Create Coupon</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
              <DialogDescription>
                {editingCoupon ? 'Update coupon details' : 'Create a new discount coupon'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Code *</label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="SAVE10"
                    required
                    disabled={!!editingCoupon}
                  />
                  <p className="text-xs text-gray-500 mt-1">Code will be stored in uppercase</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'percentage' | 'fixed' })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Amount *</label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value, 10) || 0 })}
                      placeholder={formData.type === 'percentage' ? '10 (for 10%)' : '500 (for $5.00)'}
                      required
                      min={0}
                      max={formData.type === 'percentage' ? 100 : undefined}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.type === 'percentage' ? '0-100' : 'Amount in cents (e.g., 500 = $5.00)'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Currency (optional)</label>
                  <Input
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    placeholder="USD"
                    maxLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">3-letter ISO code, leave empty for all currencies</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Uses (optional)</label>
                    <Input
                      type="number"
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                      placeholder="Unlimited"
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Per User Limit (optional)</label>
                    <Input
                      type="number"
                      value={formData.perUserLimit}
                      onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
                      placeholder="Unlimited"
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Min Order Amount (optional)</label>
                  <Input
                    type="number"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    placeholder="No minimum"
                    min={0}
                  />
                  <p className="text-xs text-gray-500 mt-1">Amount in cents (e.g., 5000 = $50.00)</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Starts At (optional)</label>
                    <Input
                      type="datetime-local"
                      value={formData.startsAt}
                      onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Ends At (optional)</label>
                    <Input
                      type="datetime-local"
                      value={formData.endsAt}
                      onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingCoupon ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && !isDialogOpen && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Coupons</CardTitle>
          <CardDescription>Manage discount codes and their usage</CardDescription>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No coupons found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Max Uses</TableHead>
                  <TableHead>Min Order</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono font-semibold">{coupon.code}</TableCell>
                    <TableCell>{coupon.type}</TableCell>
                    <TableCell>{formatAmount(coupon)}</TableCell>
                    <TableCell>{coupon.usedCount}</TableCell>
                    <TableCell>{coupon.maxUses ?? '∞'}</TableCell>
                    <TableCell>
                      {coupon.minOrderAmount ? `$${(coupon.minOrderAmount / 100).toFixed(2)}` : 'None'}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(coupon.startsAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(coupon.endsAt)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${coupon.isActive === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {coupon.isActive === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(coupon)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm(coupon)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Coupon</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete coupon <strong>{deleteConfirm?.code}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

