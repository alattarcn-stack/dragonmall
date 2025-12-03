# Monitoring & Error Tracking

Dragon Station 2026 uses [Sentry](https://sentry.io) for error tracking and monitoring across all components.

## Overview

Sentry is integrated into:
- **API Worker** (`infra/api-worker`) - Cloudflare Workers
- **Store Frontend** (`apps/store`) - Next.js
- **Admin Frontend** (`apps/admin`) - Next.js

## Setup

### 1. Create Sentry Projects

1. Go to [Sentry Dashboard](https://sentry.io)
2. Create three projects (one for each component):
   - **API Worker**: Choose "Cloudflare Workers" as the platform
   - **Store Frontend**: Choose "Next.js" as the platform
   - **Admin Frontend**: Choose "Next.js" as the platform

3. Copy the DSN for each project (you'll need these for environment variables)

### 2. Configure Environment Variables

#### API Worker

Set the Sentry DSN as a secret:

```bash
wrangler secret put SENTRY_DSN
# Paste the DSN from your Sentry project
```

Or via Cloudflare Dashboard:
- Workers → dragon-station-2026-api → Settings → Variables → Secrets
- Add `SENTRY_DSN` with your DSN value

#### Store Frontend (Cloudflare Pages)

Add these environment variables in Cloudflare Pages Dashboard:
- `NEXT_PUBLIC_SENTRY_DSN` - Client-side DSN (must be public)
- `SENTRY_DSN` - Server-side DSN
- `SENTRY_ORG` - Organization slug (optional, for source maps)
- `SENTRY_PROJECT` - Project slug (optional, for source maps)

#### Admin Frontend (Cloudflare Pages)

Add the same environment variables as the store:
- `NEXT_PUBLIC_SENTRY_DSN` - Client-side DSN
- `SENTRY_DSN` - Server-side DSN
- `SENTRY_ORG` - Organization slug (optional)
- `SENTRY_PROJECT` - Project slug (optional)

### 3. Enable/Disable Sentry

Sentry is **automatically enabled** when:
- `ENVIRONMENT=production` (for API worker)
- `NODE_ENV=production` (for Next.js apps)
- DSN is set in environment variables

Sentry is **automatically disabled** when:
- Running in development mode
- DSN is not set

**No code changes needed** - just set or unset the DSN environment variables.

## Features

### API Worker

- **Error Tracking**: Uncaught errors are automatically captured
- **Request Context**: Each error includes:
  - Request ID (unique per request)
  - Route path
  - HTTP method
  - User ID (if authenticated)
  - User role (admin/customer)
- **Breadcrumbs**: Log messages are sent as breadcrumbs for debugging
- **Performance Monitoring**: 10% of requests are traced for performance

### Next.js Apps (Store & Admin)

- **Client-Side Errors**: React errors, unhandled promise rejections
- **Server-Side Errors**: API route errors, server components
- **Edge Errors**: Middleware and edge route errors
- **Session Replay**: Recorded sessions for errors (10% sample rate)
- **Source Maps**: Automatic source map upload for better stack traces

## Viewing Errors

### Sentry Dashboard

1. Go to [Sentry Dashboard](https://sentry.io)
2. Select your project (API, Store, or Admin)
3. View errors in the **Issues** tab
4. Click on an error to see:
   - Stack trace
   - Request context
   - User information
   - Breadcrumbs (log messages)
   - Environment details

### Request ID Tracking

Each API request has a unique `X-Request-ID` header that:
- Is included in error reports
- Can be used to trace requests across logs
- Is returned in error responses

Example error response:
```json
{
  "error": "Internal server error",
  "requestId": "1234567890-abc123-def456"
}
```

Use this `requestId` to search for the error in Sentry.

## Logging Helpers

The API worker includes logging utilities in `infra/api-worker/src/utils/logging.ts`:

```typescript
import { logInfo, logError, logWarn } from './utils/logging'

// Info log (console + Sentry breadcrumb in production)
logInfo('User logged in', { userId: 123 }, env)

// Error log (console + Sentry error in production)
logError('Failed to process order', error, { orderId: 456 }, env)

// Warning log (console + Sentry breadcrumb in production)
logWarn('Rate limit approaching', { ip: '1.2.3.4' }, env)
```

In development, these only log to console. In production with Sentry enabled, they also send data to Sentry.

## Performance Monitoring

Sentry automatically tracks:
- **API Worker**: Request duration, database query time
- **Next.js Apps**: Page load time, API route duration

View performance data in Sentry Dashboard → **Performance** tab.

## Alerts & Notifications

Configure alerts in Sentry:

1. Go to Sentry Dashboard → **Alerts**
2. Create a new alert rule
3. Set conditions (e.g., error rate > threshold)
4. Configure notifications (email, Slack, etc.)

## Best Practices

1. **Don't log sensitive data**: Passwords, tokens, credit card numbers
2. **Use structured logging**: Include context in meta objects
3. **Set appropriate sample rates**: Adjust `tracesSampleRate` if needed
4. **Monitor error rates**: Set up alerts for sudden spikes
5. **Review errors regularly**: Triage and fix issues promptly

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN is set**: Verify environment variables
2. **Check environment**: Must be `production` for API worker, `NODE_ENV=production` for Next.js
3. **Check Sentry dashboard**: Ensure project is active
4. **Check network**: Ensure Sentry can be reached from Cloudflare

### Too Many Errors

1. **Adjust sample rate**: Reduce `tracesSampleRate` in config files
2. **Filter errors**: Use Sentry's filtering options
3. **Ignore known errors**: Use `beforeSend` hook to filter

### Source Maps Not Working

1. **Check SENTRY_ORG and SENTRY_PROJECT**: Must be set for source map uploads
2. **Check build process**: Source maps are uploaded during build
3. **Check Sentry auth token**: May need to set `SENTRY_AUTH_TOKEN` for CI/CD

## Disabling Sentry

To disable Sentry:

1. **API Worker**: Remove or unset `SENTRY_DSN` secret
2. **Next.js Apps**: Remove or unset `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`

Sentry will automatically be disabled when DSN is not available.

## Additional Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Cloudflare Workers Integration](https://docs.sentry.io/platforms/javascript/guides/cloudflare-workers/)
- [Next.js Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

