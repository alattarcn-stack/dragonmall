import { apiClient } from './client'
import type { Product, Order, InventoryItem, SupportTicket, Coupon } from '@dragon/core'

// Auth
export async function adminLogin(email: string, password: string) {
  const response = await apiClient.post<{ token: string }>('/api/admin/auth/login', {
    email,
    password,
  })
  return response.data
}

// Products
export async function getAdminProducts() {
  const response = await apiClient.get<{ data: Product[] }>('/api/admin/products')
  return response.data.data || []
}

export async function getAdminProduct(id: number) {
  const response = await apiClient.get<{ data: Product }>(`/api/admin/products/${id}`)
  return response.data.data
}

export async function createProduct(product: Partial<Product>) {
  const response = await apiClient.post<{ data: Product }>('/api/admin/products', product)
  return response.data.data
}

export async function updateProduct(id: number, product: Partial<Product>) {
  const response = await apiClient.put<{ data: Product }>(`/api/admin/products/${id}`, product)
  return response.data.data
}

export async function deleteProduct(id: number) {
  await apiClient.delete(`/api/admin/products/${id}`)
}

export async function uploadProductFile(productId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/admin/products/${productId}/files`,
    {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest', // CSRF protection
      },
      credentials: 'include', // Include HTTP-only cookie
      body: formData,
    }
  )

  if (!response.ok) {
    throw new Error('Failed to upload file')
  }

  return response.json()
}

// Orders
export async function getAdminOrders() {
  const response = await apiClient.get<{ data: Order[] }>('/api/admin/orders')
  return response.data.data || []
}

export async function getAdminOrder(id: number) {
  const response = await apiClient.get<{ data: Order & { payment?: any; refunds?: any[] } }>(`/api/admin/orders/${id}`)
  return response.data.data
}

export async function refundOrder(id: number, reason?: string) {
  const response = await apiClient.post<{ data: { refund: any; order: Order; payment: any } }>(`/api/admin/orders/${id}/refund`, {
    reason,
  })
  return response.data.data
}

// Inventory
export async function getInventoryItems(productId?: number) {
  const params = productId ? `?productId=${productId}` : ''
  const response = await apiClient.get<{ data: InventoryItem[] }>(`/api/admin/inventory${params}`)
  return response.data.data || []
}

export async function uploadInventoryItems(productId: number, items: Array<{ licenseCode: string; password?: string }>) {
  const response = await apiClient.post<{ data: { added: number } }>(`/api/admin/inventory`, {
    productId,
    items,
  })
  return response.data.data
}

// Support
export async function getSupportTickets() {
  const response = await apiClient.get<{ data: SupportTicket[] }>('/api/admin/support')
  return response.data.data || []
}

export async function getSupportTicket(id: number) {
  const response = await apiClient.get<{ data: SupportTicket }>(`/api/admin/support/${id}`)
  return response.data.data
}

export async function replyToTicket(id: number, reply: string) {
  const response = await apiClient.post<{ data: SupportTicket }>(`/api/admin/support/${id}/reply`, {
    reply,
  })
  return response.data.data
}

// Coupons
export async function getCoupons(includeInactive = false) {
  const response = await apiClient.get<{ data: Coupon[] }>(
    `/api/admin/coupons${includeInactive ? '?includeInactive=true' : ''}`
  )
  return response.data.data || []
}

export async function getCoupon(id: number) {
  const response = await apiClient.get<{ data: Coupon }>(`/api/admin/coupons/${id}`)
  return response.data.data
}

export async function createCoupon(coupon: {
  code: string
  type: 'percentage' | 'fixed'
  amount: number
  currency?: string | null
  maxUses?: number | null
  perUserLimit?: number | null
  minOrderAmount?: number | null
  startsAt?: number | null
  endsAt?: number | null
  isActive?: boolean
}) {
  const response = await apiClient.post<{ data: Coupon }>('/api/admin/coupons', coupon)
  return response.data.data
}

export async function updateCoupon(id: number, coupon: Partial<{
  code: string
  type: 'percentage' | 'fixed'
  amount: number
  currency?: string | null
  maxUses?: number | null
  perUserLimit?: number | null
  minOrderAmount?: number | null
  startsAt?: number | null
  endsAt?: number | null
  isActive?: boolean
}>) {
  const response = await apiClient.put<{ data: Coupon }>(`/api/admin/coupons/${id}`, coupon)
  return response.data.data
}

export async function deleteCoupon(id: number) {
  await apiClient.delete(`/api/admin/coupons/${id}`)
}

// Dashboard Stats
export async function getDashboardStats() {
  const response = await apiClient.get<{
    data: {
      totalOrders: number
      totalRevenue: number
      totalProducts: number
      totalUsers: number
      recentOrders: Order[]
      topProducts: Array<{ productId: number; name: string; sales: number }>
    }
  }>('/api/admin/dashboard')
  return response.data.data
}

