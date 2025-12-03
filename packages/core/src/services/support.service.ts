import type { SupportTicket } from '../types'
import type { D1Database } from '@cloudflare/workers-types'

export class SupportService {
  constructor(private db: D1Database) {}

  async getById(id: number): Promise<SupportTicket | null> {
    const result = await this.db
      .prepare('SELECT * FROM support_tickets WHERE id = ?')
      .bind(id)
      .first<SupportTicket>()

    return result || null
  }

  async getByUserId(userId: number): Promise<SupportTicket[]> {
    const result = await this.db
      .prepare('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<SupportTicket>()

    return result.results || []
  }

  async getByOrderId(orderId: number): Promise<SupportTicket[]> {
    const result = await this.db
      .prepare('SELECT * FROM support_tickets WHERE order_id = ? ORDER BY created_at DESC')
      .bind(orderId)
      .all<SupportTicket>()

    return result.results || []
  }

  async getAll(options?: {
    status?: 'pending' | 'processing' | 'completed'
    limit?: number
    offset?: number
  }): Promise<SupportTicket[]> {
    let query = 'SELECT * FROM support_tickets WHERE 1=1'
    const binds: unknown[] = []

    if (options?.status) {
      query += ' AND status = ?'
      binds.push(options.status)
    }

    query += ' ORDER BY created_at DESC'

    if (options?.limit) {
      query += ' LIMIT ?'
      binds.push(options.limit)
    }

    if (options?.offset) {
      query += ' OFFSET ?'
      binds.push(options.offset)
    }

    const result = await this.db.prepare(query).bind(...binds).all<SupportTicket>()
    return result.results || []
  }

  async create(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'repliedAt'>): Promise<SupportTicket> {
    const createdAt = Math.floor(Date.now() / 1000)

    const result = await this.db
      .prepare(
        'INSERT INTO support_tickets (user_id, order_id, content, reply, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(
        ticket.userId,
        ticket.orderId || null,
        ticket.content,
        ticket.reply || null,
        ticket.status,
        createdAt
      )
      .run()

    const id = result.meta.last_row_id
    if (!id) {
      throw new Error('Failed to create support ticket')
    }

    return {
      id: Number(id),
      ...ticket,
      createdAt,
    }
  }

  async reply(id: number, reply: string): Promise<SupportTicket> {
    const repliedAt = Math.floor(Date.now() / 1000)

    await this.db
      .prepare('UPDATE support_tickets SET reply = ?, status = ?, replied_at = ? WHERE id = ?')
      .bind(reply, 'completed', repliedAt, id)
      .run()

    const ticket = await this.getById(id)
    if (!ticket) {
      throw new Error('Support ticket not found')
    }

    return ticket
  }

  async updateStatus(id: number, status: SupportTicket['status']): Promise<SupportTicket> {
    await this.db
      .prepare('UPDATE support_tickets SET status = ? WHERE id = ?')
      .bind(status, id)
      .run()

    const ticket = await this.getById(id)
    if (!ticket) {
      throw new Error('Support ticket not found')
    }

    return ticket
  }
}
