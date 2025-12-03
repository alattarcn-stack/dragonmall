import type { ApiResponse, ApiError } from './types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', // CSRF protection
      ...options.headers,
    }
    
    // Include credentials (cookies) for all requests
    // Admin token is now in HTTP-only cookie, so no need to manually add it
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Important: include cookies for HTTP-only token
    }
    
    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        code: response.status === 404 ? 'NOT_FOUND' : 'UNKNOWN_ERROR',
        message: response.status === 404 ? 'Not found' : 'An unknown error occurred',
      }))
      error.code = error.code || (response.status === 404 ? 'NOT_FOUND' : 'UNKNOWN_ERROR')
      throw error
    }

    return response.json()
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const apiClient = new ApiClient()

