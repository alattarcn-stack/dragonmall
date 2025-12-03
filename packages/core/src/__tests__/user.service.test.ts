import { describe, it, expect, beforeEach } from 'vitest'
import { UserService } from '../services/user.service'
import { MockD1Database } from './utils/mock-d1'
import bcrypt from 'bcryptjs'

// Password utilities for testing
async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

describe('UserService', () => {
  let db: MockD1Database
  let userService: UserService

  beforeEach(() => {
    db = new MockD1Database()
    userService = new UserService(db as any)
  })

  describe('create', () => {
    it('should create an admin user with hashed password', async () => {
      const password = 'Admin123!'
      const passwordHash = await hashPassword(password)

      const user = await userService.create({
        email: 'admin@example.com',
        username: 'Admin',
        passwordHash,
        role: 'admin',
        isActive: 1,
      })

      expect(user.id).toBeDefined()
      expect(user.email).toBe('admin@example.com')
      expect(user.passwordHash).toBe(passwordHash)
      expect(user.role).toBe('admin')
      expect(user.isActive).toBe(1)

      // Verify password can be checked
      const isValid = await verifyPassword(password, user.passwordHash)
      expect(isValid).toBe(true)
    })

    it('should create a customer user', async () => {
      const password = 'Customer123!'
      const passwordHash = await hashPassword(password)

      const user = await userService.create({
        email: 'customer@example.com',
        passwordHash,
        role: 'customer',
        isActive: 1,
      })

      expect(user.id).toBeDefined()
      expect(user.email).toBe('customer@example.com')
      expect(user.role).toBe('customer')
    })
  })

  describe('getByEmail', () => {
    it('should retrieve user by email', async () => {
      const passwordHash = await hashPassword('Test123!')
      
      await userService.create({
        email: 'test@example.com',
        passwordHash,
        role: 'admin',
        isActive: 1,
      })

      const user = await userService.getByEmail('test@example.com')
      expect(user).not.toBeNull()
      expect(user?.email).toBe('test@example.com')
    })

    it('should return null for non-existent email', async () => {
      const user = await userService.getByEmail('nonexistent@example.com')
      expect(user).toBeNull()
    })
  })

  describe('getById', () => {
    it('should retrieve user by id', async () => {
      const passwordHash = await hashPassword('Test123!')
      
      const created = await userService.create({
        email: 'test@example.com',
        passwordHash,
        role: 'admin',
        isActive: 1,
      })

      const user = await userService.getById(created.id)
      expect(user).not.toBeNull()
      expect(user?.id).toBe(created.id)
      expect(user?.email).toBe('test@example.com')
    })
  })

  describe('password verification', () => {
    it('should verify correct password', async () => {
      const password = 'CorrectPassword123!'
      const passwordHash = await hashPassword(password)

      const user = await userService.create({
        email: 'test@example.com',
        passwordHash,
        role: 'admin',
        isActive: 1,
      })

      const isValid = await verifyPassword(password, user.passwordHash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'CorrectPassword123!'
      const wrongPassword = 'WrongPassword123!'
      const passwordHash = await hashPassword(password)

      const user = await userService.create({
        email: 'test@example.com',
        passwordHash,
        role: 'admin',
        isActive: 1,
      })

      const isValid = await verifyPassword(wrongPassword, user.passwordHash)
      expect(isValid).toBe(false)
    })
  })

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const passwordHash = await hashPassword('Test123!')
      
      const user = await userService.create({
        email: 'test@example.com',
        passwordHash,
        role: 'admin',
        isActive: 1,
      })

      await userService.updateLastLogin(user.id)

      const updated = await userService.getById(user.id)
      expect(updated?.lastLoginAt).toBeDefined()
      expect(updated?.lastLoginAt).toBeGreaterThan(0)
    })
  })
})

