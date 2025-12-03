import type { DownloadRecord } from '../types'
import type { D1Database } from '@cloudflare/workers-types'

export class DownloadService {
  constructor(
    private db: D1Database,
    private r2Bucket: R2Bucket
  ) {}

  async createDownloadLink(
    orderId: number,
    productId: number,
    userId?: number,
    productFileId?: number
  ): Promise<DownloadRecord> {
    // Get order to verify
    const orderResult = await this.db
      .prepare('SELECT status FROM orders WHERE id = ?')
      .bind(orderId)
      .first<{ status: string }>()

    if (!orderResult || orderResult.status !== 'completed') {
      throw new Error('Order not found or not completed')
    }

    // Get product file if specified
    let r2Key: string | null = null
    let fileName: string | null = null
    let maxDownloads: number | null = null
    let expiresAt: number | null = null

    if (productFileId) {
      const fileResult = await this.db
        .prepare('SELECT r2_key, file_name, max_downloads, expires_at FROM product_files WHERE id = ?')
        .bind(productFileId)
        .first<{
          r2_key: string
          file_name: string
          max_downloads: number | null
          expires_at: number | null
        }>()

      if (fileResult) {
        r2Key = fileResult.r2_key
        fileName = fileResult.file_name
        maxDownloads = fileResult.max_downloads
        expiresAt = fileResult.expires_at
      }
    } else {
      // Get first file for product
      const fileResult = await this.db
        .prepare('SELECT r2_key, file_name, max_downloads, expires_at FROM product_files WHERE product_id = ? LIMIT 1')
        .bind(productId)
        .first<{
          r2_key: string
          file_name: string
          max_downloads: number | null
          expires_at: number | null
        }>()

      if (fileResult) {
        r2Key = fileResult.r2_key
        fileName = fileResult.file_name
        maxDownloads = fileResult.max_downloads
        expiresAt = fileResult.expires_at
      }
    }

    if (!r2Key) {
      throw new Error('No file found for product')
    }

    // Generate signed URL (in production, use R2 signed URLs)
    // For now, return a placeholder URL
    const downloadUrl = `/api/downloads/${orderId}/${r2Key}`

    const createdAt = Math.floor(Date.now() / 1000)

    const result = await this.db
      .prepare(
        'INSERT INTO downloads (order_id, user_id, product_id, product_file_id, download_url, download_count, max_downloads, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        orderId,
        userId || null,
        productId,
        productFileId || null,
        downloadUrl,
        0,
        maxDownloads || null,
        expiresAt || null,
        createdAt
      )
      .run()

    const id = result.meta.last_row_id
    if (!id) {
      throw new Error('Failed to create download record')
    }

    return {
      id: Number(id),
      orderId,
      userId: userId || null,
      productId,
      productFileId: productFileId || null,
      downloadUrl,
      downloadCount: 0,
      maxDownloads: maxDownloads || null,
      expiresAt: expiresAt || null,
      createdAt,
    }
  }

  async getByOrderId(orderId: number): Promise<DownloadRecord[]> {
    const result = await this.db
      .prepare('SELECT * FROM downloads WHERE order_id = ?')
      .bind(orderId)
      .all<DownloadRecord>()

    return result.results || []
  }

  async recordDownload(downloadId: number): Promise<DownloadRecord> {
    const lastDownloadedAt = Math.floor(Date.now() / 1000)

    await this.db
      .prepare(
        'UPDATE downloads SET download_count = download_count + 1, last_downloaded_at = ? WHERE id = ?'
      )
      .bind(lastDownloadedAt, downloadId)
      .run()

    const result = await this.db
      .prepare('SELECT * FROM downloads WHERE id = ?')
      .bind(downloadId)
      .first<DownloadRecord>()

    if (!result) {
      throw new Error('Download record not found')
    }

    return result
  }

  async validateDownload(downloadId: number): Promise<boolean> {
    const download = await this.db
      .prepare('SELECT * FROM downloads WHERE id = ?')
      .bind(downloadId)
      .first<DownloadRecord>()

    if (!download) {
      return false
    }

    // Check max downloads
    if (download.maxDownloads !== null && download.downloadCount >= download.maxDownloads) {
      return false
    }

    // Check expiration
    if (download.expiresAt !== null && download.expiresAt < Math.floor(Date.now() / 1000)) {
      return false
    }

    return true
  }
}

