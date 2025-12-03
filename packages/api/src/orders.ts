import { apiClient } from './client'
import type { Order, CreateOrderRequest } from '@dragon/core'

export async function createDraftOrder(
  productId: number,
  quantity: number,
  customerEmail: string,
  customerData?: Record<string, unknown>
): Promise<Order> {
  const request: CreateOrderRequest = {
    productId,
    quantity,
    customerEmail,
    customerData,
  }

  const response = await apiClient.post<{ data: Order }>('/api/orders', request)
  return response.data.data
}

export async function getOrder(orderId: number): Promise<Order | null> {
  try {
    const response = await apiClient.get<{ data: Order & { items?: unknown[] } }>(`/api/orders/${orderId}`)
    return response.data.data || null
  } catch (error: any) {
    if (error.code === 'NOT_FOUND' || error.message?.includes('404')) {
      return null
    }
    throw error
  }
}

