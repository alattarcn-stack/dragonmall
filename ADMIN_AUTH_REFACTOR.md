# Admin Authentication Refactor - Implementation Summary

## Overview

This document summarizes the production-ready admin authentication refactor that replaces the insecure base64 token system with proper JWT authentication and password hashing.

## Changes Implemented

### 1. Dependencies Added

**File**: `infra/api-worker/package.json`

- `jose` (^5.2.0) - JWT signing and verification
- `bcryptjs` (^2.4.3) - Password hashing
- `@types/bcryptjs` (^2.4.6) - TypeScript types

### 2. Database Schema Updates

**File**: `infra/db/schema.sql`

- Added `role` column to `users` table:
  - Type: `TEXT NOT NULL CHECK(role IN ('admin', 'customer'))`
  - Default: `'admin'`

**Migration File**: `infra/db/migrations/add_role_to_users.sql`
- For existing databases, run this migration to add the role column

### 3. New Utility Files

#### Password Utilities
**File**: `infra/api-worker/src/utils/password.ts`
- `hashPassword(plain: string)` - Hashes passwords with bcrypt (salt rounds: 12)
- `verifyPassword(plain: string, hash: string)` - Verifies passwords against hashes

#### JWT Utilities
**File**: `infra/api-worker/src/utils/jwt.ts`
- `signJWT(payload, secret, expiresIn)` - Creates signed JWT tokens
- `verifyJWT(token, secret)` - Verifies and decodes JWT tokens
- `getJWTSecret(env)` - Gets JWT secret from environment

#### Rate Limiting
**File**: `infra/api-worker/src/utils/rate-limit.ts`
- `checkRateLimit(kv, key, maxAttempts, windowSeconds)` - Implements sliding window rate limiting
- Tracks attempts per IP and email
- Default: 5 attempts per 10 minutes

### 4. Refactored Admin Auth Routes

**File**: `infra/api-worker/src/routes/admin-auth.ts`

**POST /api/admin/auth/login**:
- ✅ Validates email and password
- ✅ Rate limiting (5 attempts per 10 minutes per IP/email)
- ✅ Looks up user by email
- ✅ Verifies password with bcrypt
- ✅ Checks user is active and has admin role
- ✅ Creates signed JWT token (24 hour expiry)
- ✅ Sets HTTP-only cookie
- ✅ Returns user info (no token in response)

**GET /api/admin/auth/me**:
- ✅ Reads token from HTTP-only cookie
- ✅ Verifies JWT signature
- ✅ Returns current user info

**POST /api/admin/auth/logout**:
- ✅ Clears HTTP-only cookie

### 5. Refactored Auth Middleware

**File**: `infra/api-worker/src/middleware/auth.ts`

**adminAuth middleware**:
- ✅ Reads token from HTTP-only cookie
- ✅ Verifies JWT with jose library
- ✅ Checks role is 'admin'
- ✅ Attaches `adminId`, `role`, `userId`, `isAdmin` to context

### 6. Admin Frontend Updates

**File**: `apps/admin/src/app/admin/login/page.tsx`
- ✅ Removed localStorage token storage
- ✅ Added `credentials: 'include'` to fetch requests
- ✅ Relies on HTTP-only cookies
- ✅ Improved error handling

**File**: `packages/api/src/client.ts`
- ✅ Removed localStorage token retrieval
- ✅ Added `credentials: 'include'` to all requests
- ✅ Cookies are automatically sent/received

### 7. Admin Seeding Script

**File**: `infra/api-worker/src/routes/admin-seed.ts`

**POST /api/admin/seed** (DEV ONLY):
- ✅ Only works in development environment
- ✅ Creates initial admin user
- ✅ Default: `admin@example.com` / `Admin123!`
- ✅ Hashes password with bcrypt
- ✅ Sets role to 'admin'

**Usage**:
```bash
curl -X POST http://localhost:8787/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "Admin123!"}'
```

### 8. Type Updates

**File**: `infra/api-worker/src/types.ts`
- ✅ Added `JWT_SECRET?: string` to `Env` interface

**File**: `packages/core/src/types.ts`
- ✅ Added `role?: 'admin' | 'customer'` to `User` interface

**File**: `packages/core/src/services/user.service.ts`
- ✅ Updated to handle `role` field in create/update operations
- ✅ Updated queries to map snake_case to camelCase

## Environment Variables Required

### Backend (Cloudflare Workers)

**Required Secret**:
```bash
wrangler secret put JWT_SECRET
```

**Recommended**: Generate a strong random secret:
```bash
# Generate a secure random secret
openssl rand -base64 32

# Set it in Cloudflare
wrangler secret put JWT_SECRET
# Paste the generated secret when prompted
```

**For Local Development** (`infra/.dev.vars`):
```toml
JWT_SECRET=your-super-secret-jwt-key-here-minimum-32-characters
ENVIRONMENT=development
```

## Database Migration

If you have an existing database, run the migration:

```bash
# Local database
wrangler d1 execute dragon-station-db --file=./infra/db/migrations/add_role_to_users.sql

# Remote database
wrangler d1 execute dragon-station-db --file=./infra/db/migrations/add_role_to_users.sql --remote
```

Or manually:
```sql
ALTER TABLE users ADD COLUMN role TEXT CHECK(role IN ('admin', 'customer')) DEFAULT 'admin';
UPDATE users SET role = 'admin' WHERE role IS NULL;
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd dragon-2026
npm install
```

### 2. Set JWT Secret

**Local Development**:
Create `infra/.dev.vars`:
```toml
JWT_SECRET=your-secret-key-here-minimum-32-characters-long
ENVIRONMENT=development
```

**Production**:
```bash
cd infra
wrangler secret put JWT_SECRET
```

### 3. Run Database Migration (if needed)

```bash
npm run db:migrate:remote
```

### 4. Create Initial Admin User

**Development Only**:
```bash
curl -X POST http://localhost:8787/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "Admin123!"}'
```

**Production**:
Create admin user manually via database or a one-time script.

### 5. Start Development Servers

```bash
# Terminal 1: API Worker
npm run dev:worker

# Terminal 2: Admin Panel
npm run dev:admin
```

## Security Improvements

### Before (Insecure)
- ❌ Base64-encoded tokens (no signature)
- ❌ No password hashing
- ❌ Accepted any password
- ❌ Token in localStorage (XSS vulnerable)
- ❌ No rate limiting

### After (Secure)
- ✅ Signed JWT tokens with HS256
- ✅ bcrypt password hashing (12 rounds)
- ✅ Real password verification
- ✅ HTTP-only cookies (XSS protection)
- ✅ Rate limiting (5 attempts / 10 min)
- ✅ Role-based access control

## API Usage

### Login

```typescript
const response = await fetch('/api/admin/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important!
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'Admin123!'
  })
})

// Token is automatically stored in HTTP-only cookie
// No need to manually handle tokens
```

### Authenticated Requests

```typescript
// Cookies are automatically sent with credentials: 'include'
const response = await fetch('/api/admin/products', {
  credentials: 'include'
})
```

### Logout

```typescript
await fetch('/api/admin/auth/logout', {
  method: 'POST',
  credentials: 'include'
})
```

## Files Modified

### Created
- `infra/api-worker/src/utils/password.ts`
- `infra/api-worker/src/utils/jwt.ts`
- `infra/api-worker/src/utils/rate-limit.ts`
- `infra/api-worker/src/routes/admin-seed.ts`
- `infra/db/migrations/add_role_to_users.sql`
- `ADMIN_AUTH_REFACTOR.md` (this file)

### Modified
- `infra/api-worker/package.json` - Added jose, bcryptjs
- `infra/api-worker/src/types.ts` - Added JWT_SECRET
- `infra/api-worker/src/routes/admin-auth.ts` - Complete refactor
- `infra/api-worker/src/middleware/auth.ts` - JWT verification
- `infra/api-worker/src/index.ts` - Added seed route
- `infra/db/schema.sql` - Added role column
- `packages/core/src/types.ts` - Added role to User
- `packages/core/src/services/user.service.ts` - Handle role field
- `apps/admin/src/app/admin/login/page.tsx` - Removed localStorage
- `packages/api/src/client.ts` - Added credentials: include

## Testing Checklist

- [ ] Login with correct credentials succeeds
- [ ] Login with incorrect password fails
- [ ] Login with non-existent email fails
- [ ] Rate limiting blocks after 5 failed attempts
- [ ] JWT token expires after 24 hours
- [ ] Logout clears cookie
- [ ] Protected routes require valid JWT
- [ ] Non-admin users cannot access admin routes
- [ ] HTTP-only cookie is set correctly
- [ ] Password is hashed in database

## Notes

1. **Token Storage**: Tokens are now stored in HTTP-only cookies, not localStorage. This prevents XSS attacks.

2. **Password Hashing**: All passwords must be hashed before storing. The seeding script handles this automatically.

3. **Rate Limiting**: Uses Cloudflare KV for distributed rate limiting. Adjust limits in `checkRateLimit` calls if needed.

4. **JWT Secret**: Must be at least 32 characters. Generate a strong random secret for production.

5. **Development Seed**: The `/api/admin/seed` endpoint is disabled in production. Remove it or add additional security if needed.

6. **Backward Compatibility**: Existing users without a role will default to 'admin'. Run the migration to set roles explicitly.

## Next Steps

1. ✅ Implement proper JWT authentication
2. ✅ Add password hashing
3. ✅ Add rate limiting
4. ⏳ Add password reset functionality
5. ⏳ Add 2FA for admin accounts
6. ⏳ Add audit logging for admin actions
7. ⏳ Add session management (view active sessions, revoke tokens)

---

*Refactor completed: 2026*

