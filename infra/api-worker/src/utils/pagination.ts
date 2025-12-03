/**
 * Pagination utilities for admin list endpoints
 */

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginationResult {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationResult
}

/**
 * Parse and validate pagination query parameters
 * 
 * @param page - Page number (1-indexed)
 * @param pageSize - Items per page
 * @param maxPageSize - Maximum allowed page size (default: 100)
 * @returns Validated pagination parameters
 */
export function parsePaginationParams(
  page?: string | number,
  pageSize?: string | number,
  maxPageSize: number = 100
): PaginationParams {
  // Default values
  const defaultPage = 1
  const defaultPageSize = 20

  // Parse page
  let parsedPage = defaultPage
  if (page !== undefined) {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page
    if (!isNaN(pageNum) && pageNum > 0) {
      parsedPage = pageNum
    }
  }

  // Parse pageSize
  let parsedPageSize = defaultPageSize
  if (pageSize !== undefined) {
    const sizeNum = typeof pageSize === 'string' ? parseInt(pageSize, 10) : pageSize
    if (!isNaN(sizeNum) && sizeNum > 0) {
      // Enforce maximum page size
      parsedPageSize = Math.min(sizeNum, maxPageSize)
    }
  }

  return {
    page: parsedPage,
    pageSize: parsedPageSize,
  }
}

/**
 * Calculate offset from page and pageSize
 */
export function getOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize
}

/**
 * Calculate total pages from total items and page size
 */
export function getTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize)
}

/**
 * Create pagination result object
 */
export function createPaginationResult(
  page: number,
  pageSize: number,
  total: number
): PaginationResult {
  return {
    page,
    pageSize,
    total,
    totalPages: getTotalPages(total, pageSize),
  }
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: createPaginationResult(page, pageSize, total),
  }
}

