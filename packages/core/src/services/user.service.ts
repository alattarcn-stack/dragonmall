import type { User } from '../types'
import type { D1Database } from '@cloudflare/workers-types'

export class UserService {
  constructor(private db: D1Database) {}

  async getById(id: number): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<{
        id: number
        email: string
        username: string | null
        password_hash: string
        role: string | null
        is_active: number
        created_at: number
        last_login_at: number | null
      }>()

    if (!result) return null

    return {
      id: result.id,
      email: result.email,
      username: result.username,
      passwordHash: result.password_hash,
      role: (result.role as 'admin' | 'customer') || 'admin',
      isActive: result.is_active,
      createdAt: result.created_at,
      lastLoginAt: result.last_login_at,
    }
  }

  async getByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<{
        id: number
        email: string
        username: string | null
        password_hash: string
        role: string | null
        is_active: number
        created_at: number
        last_login_at: number | null
      }>()

    if (!result) return null

    return {
      id: result.id,
      email: result.email,
      username: result.username,
      passwordHash: result.password_hash,
      role: (result.role as 'admin' | 'customer') || 'admin',
      isActive: result.is_active,
      createdAt: result.created_at,
      lastLoginAt: result.last_login_at,
    }
  }

  async create(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const createdAt = Math.floor(Date.now() / 1000)
    const role = user.role || 'admin' // Default to admin
    
    const result = await this.db
      .prepare(
        'INSERT INTO users (email, username, password_hash, role, is_active, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        user.email,
        user.username || null,
        user.passwordHash,
        role,
        user.isActive,
        createdAt,
        user.lastLoginAt || null
      )
      .run()

    const id = result.meta.last_row_id
    if (!id) {
      throw new Error('Failed to create user')
    }

    return {
      id: Number(id),
      ...user,
      role,
      createdAt,
    }
  }

  async update(id: number, updates: Partial<User>): Promise<User> {
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error('User not found')
    }

    const updated: User = { ...existing, ...updates }

    await this.db
      .prepare(
        'UPDATE users SET email = ?, username = ?, password_hash = ?, role = ?, is_active = ?, last_login_at = ? WHERE id = ?'
      )
      .bind(
        updated.email,
        updated.username || null,
        updated.passwordHash,
        updated.role || 'admin',
        updated.isActive,
        updated.lastLoginAt || null,
        id
      )
      .run()

    return updated
  }

  async updateLastLogin(id: number): Promise<void> {
    const lastLoginAt = Math.floor(Date.now() / 1000)
    await this.db
      .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .bind(lastLoginAt, id)
      .run()
  }

  async getAll(): Promise<User[]> {
    const result = await this.db
      .prepare('SELECT * FROM users ORDER BY created_at DESC')
      .all<User>()

    return result.results || []
  }
}
