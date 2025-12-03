import type { Env } from '../../types'
import { UserService } from '@dragon/core'
import { hashPassword } from '../../utils/password'
import { MockD1Database } from '../../../../../packages/core/src/__tests__/utils/mock-d1'

/**
 * Create a test environment with mock D1 database
 */
export function createTestEnv(): Env {
  const db = new MockD1Database()
  
  return {
    D1_DATABASE: db as any,
    R2_BUCKET: {} as any,
    KV_SESSIONS: {} as any,
    QUEUE_WEBHOOKS: {} as any,
    ENVIRONMENT: 'test',
    JWT_SECRET: 'test-jwt-secret-key-minimum-32-characters-long',
  }
}

/**
 * Create a test admin user in the database
 */
export async function createTestAdmin(env: Env, email: string = 'admin@example.com', password: string = 'Admin123!') {
  const userService = new UserService(env.D1_DATABASE)
  const passwordHash = await hashPassword(password)
  
  const user = await userService.create({
    email,
    username: 'Admin',
    passwordHash,
    role: 'admin',
    isActive: 1,
  })

  return {
    id: user.id,
    email,
    password,
  }
}

/**
 * Create a test customer user
 */
export async function createTestCustomer(env: Env, email: string = 'customer@example.com', password: string = 'Customer123!') {
  const userService = new UserService(env.D1_DATABASE)
  const passwordHash = await hashPassword(password)
  
  const user = await userService.create({
    email,
    passwordHash,
    role: 'customer',
    isActive: 1,
  })

  return {
    id: user.id,
    email,
    password,
  }
}

