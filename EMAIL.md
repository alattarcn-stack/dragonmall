# Email Configuration

Dragon Station 2026 uses a provider-agnostic email system that supports multiple email providers. Currently supported providers are Resend and SendGrid.

## Email Providers

### Resend (Recommended)

[Resend](https://resend.com) is a modern email API designed for developers.

**Setup:**
1. Sign up at https://resend.com
2. Get your API key from the dashboard
3. Set environment variables (see below)

### SendGrid

[SendGrid](https://sendgrid.com) is a popular email delivery service.

**Setup:**
1. Sign up at https://sendgrid.com
2. Create an API key in Settings → API Keys
3. Set environment variables (see below)

## Environment Variables

### API Worker (Cloudflare Workers)

Set these as secrets using `wrangler secret put`:

#### EMAIL_PROVIDER
- **Purpose**: Email provider to use
- **Required**: No (defaults to 'resend' if not specified)
- **Format**: String (`'resend'` or `'sendgrid'`)
- **Set via**: `wrangler secret put EMAIL_PROVIDER`
- **Example**: `"resend"`

#### EMAIL_API_KEY
- **Purpose**: API key for the email provider
- **Required**: Yes (if sending emails)
- **Format**: String
- **Set via**: `wrangler secret put EMAIL_API_KEY`
- **Where to get**:
  - **Resend**: Dashboard → API Keys → Create API Key
  - **SendGrid**: Settings → API Keys → Create API Key

#### EMAIL_FROM
- **Purpose**: From email address for all emails
- **Required**: No (defaults to 'noreply@example.com')
- **Format**: String (email address)
- **Set via**: `wrangler secret put EMAIL_FROM`
- **Example**: `"noreply@dragonstation.com"`
- **Note**: Must be verified with your email provider

#### FRONTEND_BASE_URL
- **Purpose**: Base URL for frontend (used in email links)
- **Required**: No (falls back to `FRONTEND_URL` or 'http://localhost:3000')
- **Format**: String (URL)
- **Set via**: `wrangler secret put FRONTEND_BASE_URL` or in `wrangler.toml` as `[vars]`
- **Example**: `"https://store.dragonstation.com"`

## Setting Up Email

### Step 1: Choose a Provider

For most use cases, Resend is recommended for its simplicity and developer-friendly API.

### Step 2: Get API Key

**Resend:**
1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Copy the key (starts with `re_`)

**SendGrid:**
1. Go to SendGrid Dashboard → Settings → API Keys
2. Click "Create API Key"
3. Choose "Full Access" or "Restricted Access" (with Mail Send permissions)
4. Copy the key

### Step 3: Verify Domain (Optional but Recommended)

For production, verify your domain with the email provider:

**Resend:**
1. Go to https://resend.com/domains
2. Add your domain
3. Add DNS records as instructed
4. Wait for verification

**SendGrid:**
1. Go to Settings → Sender Authentication
2. Authenticate your domain
3. Add DNS records as instructed

### Step 4: Set Environment Variables

```bash
# Set provider (optional, defaults to resend)
wrangler secret put EMAIL_PROVIDER
# Enter: resend

# Set API key (required)
wrangler secret put EMAIL_API_KEY
# Paste your API key

# Set from address (required for production)
wrangler secret put EMAIL_FROM
# Enter: noreply@yourdomain.com

# Set frontend URL (for email links)
wrangler secret put FRONTEND_BASE_URL
# Enter: https://store.yourdomain.com
```

Or set in `wrangler.toml` (for non-secret variables):

```toml
[vars]
FRONTEND_BASE_URL = "https://store.yourdomain.com"
```

### Step 5: Test Email

After deployment, test by:
1. Requesting a password reset
2. Checking your email inbox
3. Verifying the email was received

## Email Types

### Order Confirmation

Sent automatically when:
- Order payment is confirmed (Stripe/PayPal webhook)
- Order is fulfilled (license codes allocated or downloads created)

**Includes:**
- Order number
- Product list
- Total amount
- Download links (for digital products)
- Link to order history

### Password Reset

Sent when:
- User requests password reset via `/api/auth/request-password-reset`

**Includes:**
- Reset link (expires in 1 hour)
- Security warning
- Instructions

### Support Reply

Sent when:
- Admin replies to a support ticket

**Includes:**
- Original ticket content
- Admin reply
- Link to view ticket

## Email Templates

Email templates are defined in `infra/api-worker/src/utils/email.ts`. They use HTML with inline CSS for maximum compatibility.

To customize templates:
1. Edit the HTML in the respective email function
2. Update styles in the `<style>` tag
3. Redeploy the worker

## Troubleshooting

### Emails Not Sending

1. **Check API key**: Verify `EMAIL_API_KEY` is set correctly
2. **Check provider**: Verify `EMAIL_PROVIDER` matches your API key
3. **Check from address**: Ensure `EMAIL_FROM` is verified with provider
4. **Check logs**: Review Cloudflare Workers logs for errors
5. **Check provider dashboard**: Look for delivery issues or rate limits

### Emails Going to Spam

1. **Verify domain**: Authenticate your domain with the provider
2. **Set SPF/DKIM records**: Add DNS records as instructed by provider
3. **Use verified from address**: Don't use generic addresses
4. **Warm up domain**: Start with low volume and gradually increase

### Rate Limits

Both Resend and SendGrid have rate limits:
- **Resend**: 100 emails/day on free tier, higher on paid
- **SendGrid**: 100 emails/day on free tier, higher on paid

For high volume, upgrade your plan or use a dedicated email service.

## Disabling Email

To disable email sending:
1. Remove or unset `EMAIL_API_KEY`
2. The system will log errors but continue functioning
3. No emails will be sent

## Adding a New Provider

To add a new email provider:

1. Create a new class implementing `EmailProvider` interface in `email.ts`:

```typescript
class NewProvider implements EmailProvider {
  private apiKey: string
  
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }
  
  async sendEmail(params: {
    to: string
    from: string
    subject: string
    html: string
    text?: string
  }): Promise<void> {
    // Implement provider-specific API call
  }
}
```

2. Add provider case in `getEmailProvider()`:

```typescript
case 'newprovider':
  return new NewProvider(apiKey)
```

3. Update documentation with provider name and setup instructions

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment-specific keys** (dev, staging, prod)
3. **Rotate keys regularly**
4. **Use domain authentication** for production
5. **Monitor email delivery** via provider dashboard
6. **Set up alerts** for delivery failures

## Cost Considerations

- **Resend**: Free tier includes 3,000 emails/month
- **SendGrid**: Free tier includes 100 emails/day
- **Production**: Consider paid plans for higher limits and better deliverability

