import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types'

/**
 * In-memory mock D1 database for testing
 * Simulates D1Database interface using a Map-based storage
 */
export class MockD1Database implements D1Database {
  private tables: Map<string, Map<number, any>> = new Map()
  private lastInsertId: Map<string, number> = new Map()

  prepare(query: string): D1PreparedStatement {
    return new MockD1PreparedStatement(query, this)
  }

  batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return Promise.all(statements.map(stmt => stmt.run()))
  }

  exec(query: string): Promise<D1ExecResult> {
    return Promise.resolve({
      count: 0,
      duration: 0,
    })
  }

  // Internal methods for mock
  _getTable(table: string): Map<number, any> {
    if (!this.tables.has(table)) {
      this.tables.set(table, new Map())
    }
    return this.tables.get(table)!
  }

  _getLastInsertId(table: string): number {
    const current = this.lastInsertId.get(table) || 0
    const next = current + 1
    this.lastInsertId.set(table, next)
    return next
  }

  _reset(): void {
    this.tables.clear()
    this.lastInsertId.clear()
  }
}

class MockD1PreparedStatement implements D1PreparedStatement {
  private query: string
  private binds: any[] = []
  private db: MockD1Database

  constructor(query: string, db: MockD1Database) {
    this.query = query.trim()
    this.db = db
  }

  bind(...values: any[]): D1PreparedStatement {
    this.binds = values
    return this
  }

  async first<T = any>(): Promise<T | null> {
    const result = await this.all<T>()
    if (result.results && result.results.length > 0) {
      return result.results[0]
    }
    return null
  }

  async run(): Promise<D1Result> {
    const query = this.query.toUpperCase()
    
    if (query.startsWith('INSERT INTO')) {
      return this._handleInsert()
    } else if (query.startsWith('UPDATE')) {
      return this._handleUpdate()
    } else if (query.startsWith('DELETE')) {
      return this._handleDelete()
    }

    return {
      success: true,
      meta: {
        duration: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    }
  }

  async all<T = any>(): Promise<D1Result<T>> {
    const query = this.query.toUpperCase()
    
    if (query.startsWith('SELECT')) {
      return this._handleSelect<T>()
    }

    return {
      success: true,
      results: [],
      meta: {
        duration: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    }
  }

  private _handleInsert(): D1Result {
    const match = this.query.match(/INSERT INTO (\w+)/i)
    if (!match) {
      throw new Error('Invalid INSERT query')
    }

    const table = match[1].toLowerCase()
    const tableData = this.db._getTable(table)
    
    // Extract column names and values
    const columnMatch = this.query.match(/\(([^)]+)\)/g)
    if (!columnMatch || columnMatch.length < 2) {
      throw new Error('Invalid INSERT query format')
    }

    const columns = columnMatch[0].slice(1, -1).split(',').map(c => c.trim())
    const id = this.db._getLastInsertId(table)
    const row: any = { id }

    columns.forEach((col, idx) => {
      if (col !== 'id') {
        // Keep column name as-is (already snake_case in database)
        row[col] = this.binds[idx] !== undefined ? this.binds[idx] : null
      }
    })

    tableData.set(id, row)

    return {
      success: true,
      meta: {
        duration: 0,
        rows_read: 0,
        rows_written: 1,
        last_row_id: id,
        changed_db: true,
        changes: 1,
      },
    }
  }

  private _handleUpdate(): D1Result {
    const match = this.query.match(/UPDATE (\w+) SET/i)
    if (!match) {
      return {
        success: true,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      }
    }

    const table = match[1].toLowerCase()
    const tableData = this.db._getTable(table)

    // Parse SET clause
    const setMatch = this.query.match(/SET ([^WHERE]+)/i)
    if (!setMatch) {
      return {
        success: true,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      }
    }

    const setClause = setMatch[1].trim()
    const updates = setClause.split(',').map(s => s.trim())
    const updateMap: Record<string, number> = {} // column -> bind index

    updates.forEach((update, idx) => {
      const [col] = update.split('=').map(s => s.trim())
      if (update.includes('?')) {
        updateMap[col] = idx
      }
    })

    // Simple WHERE id = ? handling
    if (this.query.includes('WHERE id = ?')) {
      const id = this.binds[this.binds.length - 1]
      const row = tableData.get(id)
      if (row) {
        Object.entries(updateMap).forEach(([col, bindIdx]) => {
          row[col] = this.binds[bindIdx]
        })
        tableData.set(id, row)
      }
    } else {
      // Update all rows (for simple cases)
      tableData.forEach((row, id) => {
        Object.entries(updateMap).forEach(([col, bindIdx]) => {
          row[col] = this.binds[bindIdx]
        })
        tableData.set(id, row)
      })
    }

    return {
      success: true,
      meta: {
        duration: 0,
        rows_read: 0,
        rows_written: 1,
        last_row_id: 0,
        changed_db: true,
        changes: 1,
      },
    }
  }

  private _handleDelete(): D1Result {
    const match = this.query.match(/DELETE FROM (\w+)/i)
    if (!match) {
      return {
        success: true,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      }
    }

    const table = match[1].toLowerCase()
    const tableData = this.db._getTable(table)

    if (this.query.includes('WHERE id = ?') && this.binds.length > 0) {
      tableData.delete(this.binds[0])
    }

    return {
      success: true,
      meta: {
        duration: 0,
        rows_read: 0,
        rows_written: 1,
        last_row_id: 0,
        changed_db: true,
        changes: 1,
      },
    }
  }

  private _handleSelect<T = any>(): D1Result<T> {
    // Handle COUNT(*) queries
    if (this.query.includes('COUNT(*)')) {
      const match = this.query.match(/FROM (\w+)/i)
      if (!match) {
        return {
          success: true,
          results: [{ count: 0 }] as T[],
          meta: {
            duration: 0,
            rows_read: 1,
            rows_written: 0,
            last_row_id: 0,
            changed_db: false,
            changes: 0,
          },
        }
      }

      const table = match[1].toLowerCase()
      const tableData = this.db._getTable(table)
      let results = Array.from(tableData.values())

      // Apply WHERE filters
      if (this.query.includes('WHERE') && this.binds.length > 0) {
        if (this.query.includes('product_id = ?') && this.query.includes('order_id IS NULL')) {
          const productId = this.binds[0]
          results = results.filter((row: any) => row.product_id === productId && !row.order_id)
        }
      }

      return {
        success: true,
        results: [{ count: results.length }] as T[],
        meta: {
          duration: 0,
          rows_read: 1,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      }
    }

    const match = this.query.match(/FROM (\w+)/i)
    if (!match) {
      return {
        success: true,
        results: [],
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      }
    }

    const table = match[1].toLowerCase()
    const tableData = this.db._getTable(table)
    let results = Array.from(tableData.values())

    // Simple WHERE clause parsing
    if (this.query.includes('WHERE') && this.binds.length > 0) {
      // WHERE id = ?
      if (this.query.includes('id = ?')) {
        const id = this.binds[0]
        results = results.filter((row: any) => row.id === id)
      }
      // WHERE email = ?
      else if (this.query.includes('email = ?')) {
        const email = this.binds[0]
        results = results.filter((row: any) => row.email === email)
      }
      // WHERE product_id = ? AND order_id IS NULL
      else if (this.query.includes('product_id = ?') && this.query.includes('order_id IS NULL')) {
        const productId = this.binds[0]
        results = results.filter((row: any) => row.product_id === productId && !row.order_id)
      }
      // WHERE order_id = ?
      else if (this.query.includes('order_id = ?')) {
        const orderId = this.binds[0]
        results = results.filter((row: any) => row.order_id === orderId)
      }
      // WHERE user_id = ?
      else if (this.query.includes('user_id = ?')) {
        const userId = this.binds[0]
        results = results.filter((row: any) => row.user_id === userId)
      }
      // WHERE product_id = ?
      else if (this.query.includes('product_id = ?')) {
        const productId = this.binds[0]
        results = results.filter((row: any) => row.product_id === productId)
      }
    }

    // Simple ORDER BY
    if (this.query.includes('ORDER BY')) {
      const orderMatch = this.query.match(/ORDER BY (\w+)(?:\s+(ASC|DESC))?/i)
      if (orderMatch) {
        const column = orderMatch[1].toLowerCase()
        const direction = (orderMatch[2] || 'ASC').toUpperCase()
        results.sort((a: any, b: any) => {
          const aVal = a[column] || 0
          const bVal = b[column] || 0
          if (direction === 'ASC') {
            return aVal > bVal ? 1 : -1
          } else {
            return aVal < bVal ? 1 : -1
          }
        })
      }
    }

    // Simple LIMIT
    if (this.query.includes('LIMIT')) {
      const limitMatch = this.query.match(/LIMIT (\d+)/i)
      if (limitMatch) {
        const limit = parseInt(limitMatch[1], 10)
        results = results.slice(0, limit)
      }
    }

    return {
      success: true,
      results: results as T[],
      meta: {
        duration: 0,
        rows_read: results.length,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    }
  }
}

interface D1ExecResult {
  count: number
  duration: number
}
