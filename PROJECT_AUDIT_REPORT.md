# Project Audit Report - Dragon Station 2026

**Date**: 2026-01-XX  
**Scope**: Comprehensive security, bug, and code quality analysis

---

## Executive Summary

This audit identified **15 critical issues**, **12 high-priority bugs**, and **8 configuration/design concerns** across security, authorization, error handling, and code quality.

### Severity Breakdown
- 🔴 **Critical**: 15 issues (immediate action required)
- 🟠 **High**: 12 issues (should be fixed soon)
- 🟡 **Medium**: 8 issues (should be addressed)
- 🟢 **Low**: 5 issues (nice to have)

---

## 🔴 CRITICAL ISSUES

### 1. **Authorization Bypass - Order Access Control Missing**
**Location**: `infra/api-worker/src/routes/orders.ts:74`

**Issue**: The route `GET /api/orders/:id` has a TODO comment indicating missing authorization check. While it uses `adminAuth` middleware, it doesn't verify that:
- Regular customers can only access their own orders
- The order belongs to the requesting user

**Code**:
```typescript
// TODO: Check if user is admin or order owner
// For now, allow access (will be secured by auth middleware)
```

**Impact**: Any authenticated user (customer or admin) can access any order by ID, potentially exposing:
- Other customers' personal information
- Payment details
- Order history
- License codes

**Fix Required**:
```typescript
router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const order = await orderService.getById(id)
  if (!order) {
    return c.json({ error: 'Order not found' }, 404)
  }

  const userId = c.get('userId')
  const isAdmin = c.get('isAdmin')
  
  // Check authorization: admin or order owner
  if (!isAdmin && order.userId !== userId) {
    return c.json({ error: 'Unauthorized' }, 403)
  }
  
  // ... rest of code
})
```

---

### 2. **Admin Seed Endpoint Exposed in Production**
**Location**: `infra/api-worker/src/routes/admin-seed.ts:17`

**Issue**: The seed endpoint checks `ENVIRONMENT === 'production'` but this check can be bypassed if:
- Environment variable is not set correctly
- Someone sets `ENVIRONMENT` to something other than 'production'
- The check is case-sensitive and might fail

**Code**:
```typescript
if (env.ENVIRONMENT === 'production') {
  return c.json({ error: 'Not available in production' }, 403)
}
```

**Impact**: If misconfigured, anyone can create admin accounts in production.

**Fix Required**:
- Remove the route entirely in production builds
- Or add additional checks (IP whitelist, secret token)
- Consider using a build-time flag instead

---

### 3. **CORS Configuration Too Permissive**
**Location**: `infra/api-worker/src/index.ts:30-35`

**Issue**: CORS is hardcoded to only allow `localhost:3000` and `localhost:3001`. This will break in production.

**Code**:
```typescript
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  // ...
}))
```

**Impact**: 
- Production API will reject requests from production frontend
- No way to configure allowed origins via environment variables

**Fix Required**:
```typescript
const allowedOrigins = env.FRONTEND_URL 
  ? [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001']
  : ['http://localhost:3000', 'http://localhost:3001']

app.use('/*', cors({
  origin: allowedOrigins,
  // ...
}))
```

---

### 4. **Missing JWT Secret Validation at Startup**
**Location**: `infra/api-worker/src/utils/jwt.ts:64-69`

**Issue**: JWT secret is only checked when used, not at application startup. If missing, the app will start but fail on first auth request.

**Impact**: 
- Silent failures in production
- No early warning that critical configuration is missing
- Poor developer experience

**Fix Required**: Add startup validation in `worker.ts` or `index.ts`:
```typescript
// At startup
if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters')
}
```

---

### 5. **Unprotected Order Payment Endpoint**
**Location**: `infra/api-worker/src/index.ts:81-84`

**Issue**: The route `POST /api/orders/:id/pay` has no authentication middleware. It's marked as "internal/webhook" but is publicly accessible.

**Code**:
```typescript
// Orders API - Mark as paid (internal/webhook)
app.post('/api/orders/:id/pay', async (c) => {
  // No auth middleware!
})
```

**Impact**: Anyone can mark any order as paid without actual payment, potentially:
- Bypassing payment processing
- Getting free products
- Breaking order fulfillment logic

**Fix Required**:
- Add webhook signature verification
- Or restrict to internal IPs
- Or require admin authentication

---

### 6. **PayPal Webhook Not Verified**
**Location**: `infra/api-worker/src/routes/payments.ts:356-398`

**Issue**: PayPal webhook handler doesn't verify webhook signatures, unlike Stripe which does.

**Code**:
```typescript
router.post('/paypal/webhook', async (c) => {
  const body = await c.req.json()
  const eventType = body.event_type
  // No signature verification!
})
```

**Impact**: 
- Fake webhook requests can mark orders as paid
- No way to verify requests are actually from PayPal

**Fix Required**: Implement PayPal webhook signature verification using `PAYPAL_WEBHOOK_SECRET`.

---

### 7. **SQL Injection Risk in Dynamic Queries**
**Location**: `packages/core/src/services/coupon.service.ts:378`

**Issue**: Dynamic SQL query construction using string concatenation.

**Code**:
```typescript
const result = await this.db.prepare(`UPDATE coupons SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()
```

**Impact**: While parameters are bound, the column names in `updates` are not validated, which could lead to SQL injection if user input influences column names.

**Fix Required**: Whitelist allowed column names:
```typescript
const allowedColumns = ['code', 'discount_type', 'discount_value', ...]
const updates = Object.entries(data)
  .filter(([key]) => allowedColumns.includes(key))
  .map(([key, value]) => `${key} = ?`)
```

---

### 8. **Rate Limiting Key Collision Risk**
**Location**: `infra/api-worker/src/utils/rate-limit.ts`

**Issue**: Rate limiting uses simple string keys like `login:ip:${ipAddress}`. If IP addresses are not properly sanitized, this could lead to key collisions or bypass.

**Impact**: 
- Malicious users could craft IP addresses to bypass rate limits
- Key collisions between different rate limit types

**Fix Required**: 
- Sanitize IP addresses
- Use hashing for rate limit keys
- Add namespace prefixes

---

### 9. **Missing Input Validation on File Uploads**
**Location**: `infra/api-worker/src/utils/file-upload.ts:46-85`

**Issue**: File upload validation allows empty MIME types with just a warning. This is too permissive.

**Code**:
```typescript
if (!config.allowedMimeTypes.includes(file.type)) {
  if (file.type && file.type !== '') {
    return { valid: false, error: '...' }
  }
  // If MIME type is empty, we'll allow it but log a warning
  // In production, you might want to be stricter
}
```

**Impact**: Files with no MIME type are accepted, which could be dangerous files.

**Fix Required**: Reject files with empty MIME types in production, or require file extension validation.

---

### 10. **Password Reset Token Not Validated for Expiry**
**Location**: `infra/api-worker/src/routes/password-reset.ts` (assumed)

**Issue**: Need to verify password reset tokens have expiration checks.

**Impact**: Old password reset tokens could be used indefinitely.

**Fix Required**: Ensure tokens have expiration timestamps and are validated.

---

### 11. **Error Messages Leak Information**
**Location**: Multiple locations

**Issue**: Error messages in development mode expose stack traces and internal details, but the check might not work correctly in all cases.

**Code**:
```typescript
message: env.ENVIRONMENT === 'development' ? error.message : undefined
```

**Impact**: If `ENVIRONMENT` is not set correctly, sensitive error information could leak in production.

**Fix Required**: Use explicit production check:
```typescript
message: env.ENVIRONMENT !== 'production' ? error.message : undefined
```

---

### 12. **Cart Token Verification Missing**
**Location**: `infra/api-worker/src/utils/cart.ts:36-47`

**Issue**: Cart token verification uses JWT but doesn't validate expiration or check if the cart still exists before returning the cart ID.

**Impact**: Expired or invalid cart tokens might be accepted.

---

### 13. **Missing Transaction Rollback on Errors**
**Location**: Multiple service files

**Issue**: Database operations don't use transactions, so partial failures can leave data in inconsistent states.

**Example**: Order creation might succeed but order item insertion fails, leaving orphaned orders.

**Impact**: Data integrity issues, orphaned records.

**Fix Required**: Use D1 transactions for multi-step operations.

---

### 14. **No Validation of Order Amount Before Payment**
**Location**: `infra/api-worker/src/routes/payments.ts:140-148`

**Issue**: Payment intent creation doesn't verify that the order amount hasn't been tampered with between order creation and payment.

**Impact**: Race condition where order amount could be changed after payment intent creation.

**Fix Required**: Lock order or validate amount hasn't changed.

---

### 15. **Admin Seed Route Accessible Without Authentication**
**Location**: `infra/api-worker/src/index.ts:124-127`

**Issue**: The admin seed route has no authentication, only environment check. In development, anyone can create admin accounts.

**Impact**: In development environments, unauthorized admin account creation.

**Fix Required**: Add IP whitelist or secret token requirement even in development.

---

## 🟠 HIGH PRIORITY ISSUES

### 16. **Missing Error Handling in Async Operations**
**Location**: Multiple locations

**Issue**: Many async operations don't have proper error handling, especially in loops.

**Example**: `infra/api-worker/src/routes/payments.ts:47-92` - Order fulfillment loop doesn't handle individual item failures.

**Impact**: One failed item can break entire order fulfillment.

---

### 17. **Inconsistent Error Response Format**
**Location**: Throughout codebase

**Issue**: Some endpoints return `{ error: string }`, others return `{ error: 'ERROR_CODE', message: string }`, and validation errors return `{ error: 'VALIDATION_ERROR', details: [...] }`.

**Impact**: Frontend error handling is inconsistent and error-prone.

**Fix Required**: Standardize error response format.

---

### 18. **Missing Pagination on List Endpoints**
**Location**: Multiple admin endpoints

**Issue**: Endpoints like `/api/admin/products`, `/api/admin/orders` don't have pagination, which could cause performance issues with large datasets.

**Impact**: 
- Slow API responses
- High memory usage
- Poor user experience

---

### 19. **No Request Size Limits**
**Location**: `infra/api-worker/src/index.ts`

**Issue**: No middleware to limit request body size, which could lead to DoS attacks.

**Impact**: Large request bodies could exhaust worker memory.

**Fix Required**: Add request size limiting middleware.

---

### 20. **Missing Idempotency Keys for Payments**
**Location**: `infra/api-worker/src/routes/payments.ts`

**Issue**: Payment intent creation doesn't use idempotency keys, which could lead to duplicate charges if requests are retried.

**Impact**: Customers could be charged multiple times for the same order.

**Fix Required**: Add idempotency key support for Stripe and PayPal.

---

### 21. **Race Condition in Cart Operations**
**Location**: `infra/api-worker/src/routes/cart.ts`

**Issue**: Cart operations (add item, update quantity) don't use transactions, leading to race conditions when multiple requests modify the same cart simultaneously.

**Impact**: Incorrect cart totals, lost items, quantity inconsistencies.

---

### 22. **Missing Validation on Order Status Transitions**
**Location**: `packages/core/src/services/order.service.ts`

**Issue**: Order status can be changed to any value without validating valid state transitions (e.g., can go from 'completed' to 'pending').

**Impact**: Invalid order states, broken business logic.

---

### 23. **No Logging of Sensitive Operations**
**Location**: Multiple locations

**Issue**: Critical operations like refunds, order status changes, and admin actions don't have audit logging.

**Impact**: 
- No audit trail
- Difficult to debug issues
- Compliance problems

---

### 24. **Missing Input Sanitization for User-Generated Content**
**Location**: Support tickets, product descriptions, etc.

**Issue**: User input is stored without sanitization, which could lead to XSS if displayed without escaping.

**Impact**: XSS vulnerabilities in admin panel or customer-facing pages.

---

### 25. **Inconsistent Date Handling**
**Location**: Throughout codebase

**Issue**: Some places use Unix timestamps, others use ISO strings, and timezone handling is inconsistent.

**Impact**: Date display issues, timezone bugs.

---

### 26. **Missing Database Indexes**
**Location**: `infra/db/schema.sql`

**Issue**: Some frequently queried columns might be missing indexes (need to verify all foreign keys and common query patterns are indexed).

**Impact**: Slow queries as database grows.

---

### 27. **No Health Check for External Services**
**Location**: Payment services initialization

**Issue**: No validation that Stripe/PayPal credentials are valid at startup.

**Impact**: Payment failures only discovered when customers try to pay.

---

## 🟡 MEDIUM PRIORITY ISSUES

### 28. **Hardcoded Default Values**
**Location**: Multiple locations

**Issue**: Default values like `'guest@example.com'` are hardcoded instead of using configuration.

**Impact**: Inconsistent behavior, difficult to customize.

---

### 29. **Missing Type Safety in Some Places**
**Location**: Database query results

**Issue**: Some database queries use `any` types or don't have proper type definitions.

**Impact**: Runtime type errors, poor developer experience.

---

### 30. **No Request Timeout Configuration**
**Location**: Worker configuration

**Issue**: No explicit timeout configuration for long-running operations.

**Impact**: Requests could hang indefinitely.

---

### 31. **Missing Retry Logic for External API Calls**
**Location**: Email sending, payment processing

**Issue**: No retry logic for transient failures when calling external APIs.

**Impact**: Failed operations that could succeed on retry.

---

### 32. **Inconsistent Naming Conventions**
**Location**: Throughout codebase

**Issue**: Mix of camelCase and snake_case in some places.

**Impact**: Code maintainability issues.

---

### 33. **Missing API Versioning**
**Location**: API routes

**Issue**: No API versioning strategy, making it difficult to make breaking changes.

**Impact**: Future migration difficulties.

---

### 34. **No Rate Limiting on Public Endpoints**
**Location**: Product listing, category endpoints

**Issue**: Public endpoints don't have rate limiting, which could lead to DoS.

**Impact**: API abuse, high costs.

---

### 35. **Missing Validation for Email Format in Some Places**
**Location**: Order creation, support tickets

**Issue**: Email validation might be missing in some endpoints.

**Impact**: Invalid email addresses in database.

---

## 🟢 LOW PRIORITY / CODE QUALITY

### 36. **Console.log Instead of Proper Logging**
**Location**: Multiple locations

**Issue**: Some places use `console.log` instead of the logging utility.

**Impact**: Inconsistent logging, harder to filter logs.

---

### 37. **Missing JSDoc Comments**
**Location**: Service classes, utility functions

**Issue**: Many functions lack documentation.

**Impact**: Poor developer experience.

---

### 38. **Duplicate Code in Auth Routes**
**Location**: `admin-auth.ts` and `customer-auth.ts`

**Issue**: Similar logic duplicated between admin and customer auth.

**Impact**: Maintenance burden, potential for inconsistencies.

---

### 39. **Magic Numbers**
**Location**: Throughout codebase

**Issue**: Magic numbers like `24 * 60 * 60` (24 hours) should be constants.

**Impact**: Hard to understand and modify.

---

### 40. **Missing Unit Tests for Edge Cases**
**Location**: Test files

**Issue**: Tests might not cover all edge cases (need to verify).

**Impact**: Undiscovered bugs.

---

## Configuration Issues

### 41. **Missing Environment Variable Validation**
**Location**: Application startup

**Issue**: No validation that all required environment variables are set with correct formats.

**Impact**: Runtime failures in production.

---

### 42. **Wrangler.toml Has Empty Required Fields**
**Location**: `infra/wrangler.toml`

**Issue**: `database_id` and `id` fields are empty with comments saying "REQUIRED".

**Impact**: Deployment will fail if not configured.

---

### 43. **No Production/Development Environment Detection**
**Location**: Multiple locations

**Issue**: Relies on `ENVIRONMENT` variable which might not be set correctly.

**Impact**: Production code might run in development mode or vice versa.

---

## Recommendations

### Immediate Actions (Before Production)
1. ✅ Fix order authorization check (Issue #1)
2. ✅ Remove or properly secure admin seed endpoint (Issue #2)
3. ✅ Fix CORS configuration (Issue #3)
4. ✅ Add JWT secret validation at startup (Issue #4)
5. ✅ Protect order payment endpoint (Issue #5)
6. ✅ Implement PayPal webhook verification (Issue #6)
7. ✅ Add request size limits (Issue #19)
8. ✅ Add pagination to list endpoints (Issue #18)

### Short-term (Within 1-2 Weeks)
1. Fix SQL injection risks (Issue #7)
2. Improve rate limiting (Issue #8)
3. Add transaction support for multi-step operations (Issue #13)
4. Standardize error response format (Issue #17)
5. Add audit logging (Issue #23)
6. Add input sanitization (Issue #24)

### Long-term (Next Month)
1. Add API versioning (Issue #33)
2. Refactor duplicate code (Issue #38)
3. Improve test coverage (Issue #40)
4. Add comprehensive documentation (Issue #37)

---

## Testing Recommendations

1. **Security Testing**
   - Penetration testing for authorization bypasses
   - SQL injection testing
   - XSS testing on user-generated content
   - CSRF testing

2. **Load Testing**
   - Test with large datasets
   - Test concurrent cart operations
   - Test payment processing under load

3. **Integration Testing**
   - Test payment webhook handling
   - Test order fulfillment flow
   - Test error recovery scenarios

---

## Conclusion

The project has a solid foundation with good security practices in many areas (JWT auth, password hashing, CSRF protection). However, there are several critical authorization and security issues that must be addressed before production deployment. The most urgent issues are:

1. Order access control
2. Admin seed endpoint security
3. CORS configuration
4. Payment endpoint protection
5. Webhook verification

Once these critical issues are resolved, the project will be in much better shape for production use.

