# Testing Guide

This document describes the testing setup and how to write and run tests for Dragon Station 2026.

## Test Framework

The project uses [Vitest](https://vitest.dev/) for testing, configured at the root level.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

### Service Tests (`packages/core/src/__tests__/`)

Service tests use an in-memory mock D1 database to test business logic in isolation:

- **`user.service.test.ts`** - Tests user creation, password hashing/verification, and authentication flows
- **`order.service.test.ts`** - Tests order creation, payment processing, and status updates
- **`inventory.service.test.ts`** - Tests license code allocation and inventory management
- **`category.service.test.ts`** - Tests category CRUD operations
- **`coupon.service.test.ts`** - Tests coupon validation, application, and usage tracking
- **`refund.service.test.ts`** - Tests refund record creation and order refund processing

### API Tests (`infra/api-worker/src/__tests__/`)

API tests test HTTP endpoints with full request/response cycle:

- **`auth.test.ts`** - Tests admin and customer authentication endpoints (login, signup, rate limiting)
- **`categories.test.ts`** - Tests category CRUD endpoints and public category listing
- **`products-search-sort.test.ts`** - Tests product search, filtering, and sorting
- **`cart-coupon.test.ts`** - Tests cart coupon application and removal
- **`dashboard.test.ts`** - Tests dashboard analytics aggregation
- **`refund.test.ts`** - Tests refund endpoint validation and processing

## Mock D1 Database

The project includes a mock D1 database implementation (`packages/core/src/__tests__/utils/mock-d1.ts`) that:

- Simulates D1Database interface using in-memory Map storage
- Handles common SQL operations (SELECT, INSERT, UPDATE, DELETE)
- Supports WHERE clauses, ORDER BY, LIMIT, and COUNT queries
- Returns data in snake_case format (matching real D1 behavior)
- Supports JOIN operations for complex queries

### Example Usage

```typescript
import { MockD1Database } from './utils/mock-d1'
import { UserService } from '../services/user.service'

describe('UserService', () => {
  let db: MockD1Database
  let userService: UserService

  beforeEach(() => {
    db = new MockD1Database()
    userService = new UserService(db as any)
  })

  it('should create a user', async () => {
    const user = await userService.create({
      email: 'test@example.com',
      passwordHash: 'hashed',
      role: 'customer',
      isActive: 1,
    })

    expect(user.id).toBeDefined()
    expect(user.email).toBe('test@example.com')
  })
})
```

## Test Helpers

### API Test Helpers (`infra/api-worker/src/__tests__/utils/test-helpers.ts`)

- `createTestEnv()` - Creates a test environment with mock D1, KV, R2, etc.
- `createTestAdmin()` - Creates a test admin user with hashed password
- `createTestCustomer()` - Creates a test customer user with hashed password

### Example API Test

```typescript
import { createTestEnv, createTestAdmin } from './utils/test-helpers'
import { createAdminAuthRouter } from '../../routes/admin-auth'

describe('Admin Auth', () => {
  let env: Env

  beforeEach(() => {
    env = createTestEnv()
  })

  it('should login with correct credentials', async () => {
    const { email, password } = await createTestAdmin(env)

    const router = createAdminAuthRouter(env)
    const req = new Request('http://localhost/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ email, password }),
    })

    const res = await router.fetch(req, env, {} as any)
    expect(res.status).toBe(200)
  })
})
```

## Writing New Tests

### Service Tests

1. Import the service and mock D1
2. Create a new mock database instance in `beforeEach`
3. Set up any required tables using `db.exec()`
4. Test the service methods with assertions

Example:
```typescript
describe('CouponService', () => {
  let db: MockD1Database
  let couponService: CouponService

  beforeEach(() => {
    db = new MockD1Database()
    couponService = new CouponService(db as any)
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS coupons (...)
    `)
  })

  it('should validate coupon correctly', async () => {
    // Test implementation
  })
})
```

### API Tests

1. Use `createTestEnv()` to set up the test environment
2. Use helper functions to create test data (users, products, etc.)
3. Create Request objects and call router.fetch()
4. Assert on response status and body

Example:
```typescript
describe('Cart API', () => {
  let env: ReturnType<typeof createTestEnv>

  beforeEach(async () => {
    env = createTestEnv()
    // Set up tables
  })

  it('should add item to cart', async () => {
    const response = await env.APP.fetch('http://localhost/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 1, quantity: 1 }),
    })
    
    expect(response.status).toBe(200)
  })
})
```

## Coverage Goals

- **Service Layer**: Aim for 80%+ coverage of business logic
- **API Layer**: Test all critical endpoints (auth, orders, payments, cart, coupons, refunds)
- **Edge Cases**: Test error handling, validation failures, rate limiting

## Continuous Integration

Tests should be run in CI/CD pipelines before deployment. The test suite is designed to be fast and isolated, making it suitable for continuous integration.

## Test Data Setup

When writing tests, ensure you:
1. Create all required tables in `beforeEach`
2. Use realistic test data
3. Clean up test data between tests (or use fresh mock DB instances)
4. Test both success and error cases
5. Test edge cases (empty results, null values, etc.)
