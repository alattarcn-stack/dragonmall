/**
 * PayPal Webhook Verification Utility
 * 
 * Verifies PayPal webhook signatures using PayPal's verification API endpoint.
 * 
 * PayPal webhook verification requires:
 * - PAYPAL_WEBHOOK_ID: The webhook ID from PayPal dashboard
 * - PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET: For API authentication
 * - Headers: paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo
 * - Raw request body (as text)
 */

export interface PayPalWebhookHeaders {
  'paypal-transmission-id': string
  'paypal-transmission-time': string
  'paypal-transmission-sig': string
  'paypal-cert-url': string
  'paypal-auth-algo': string
}

/**
 * Get PayPal OAuth access token for API calls
 */
async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  isProduction: boolean
): Promise<string> {
  const baseUrl = isProduction
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

  // Use basic auth
  const auth = btoa(`${clientId}:${clientSecret}`)
  const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en_US',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!authResponse.ok) {
    throw new Error(`Failed to get PayPal access token: ${authResponse.status}`)
  }

  const data = await authResponse.json()
  return data.access_token
}

/**
 * Verify PayPal webhook signature using PayPal's verification API
 * 
 * @param body - Raw request body as string
 * @param headers - PayPal webhook headers
 * @param webhookId - PayPal webhook ID from environment
 * @param clientId - PayPal client ID
 * @param clientSecret - PayPal client secret
 * @param isProduction - Whether using production PayPal API
 * @returns true if signature is valid, false otherwise
 */
export async function verifyPayPalWebhook(
  body: string,
  headers: PayPalWebhookHeaders,
  webhookId: string,
  clientId: string,
  clientSecret: string,
  isProduction: boolean = false
): Promise<boolean> {
  try {
    // Check all required headers are present
    if (!headers['paypal-transmission-id'] ||
        !headers['paypal-transmission-time'] ||
        !headers['paypal-transmission-sig'] ||
        !headers['paypal-cert-url'] ||
        !headers['paypal-auth-algo']) {
      console.error('Missing required PayPal webhook headers')
      return false
    }

    // Get access token
    const accessToken = await getPayPalAccessToken(clientId, clientSecret, isProduction)

    // Call PayPal's verification API
    const baseUrl = isProduction
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com'

    const verificationPayload = {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(body), // Parse body for verification
    }

    const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(verificationPayload),
    })

    if (!verifyResponse.ok) {
      console.error('PayPal verification API error:', verifyResponse.status)
      return false
    }

    const verificationResult = await verifyResponse.json()
    return verificationResult.verification_status === 'SUCCESS'
  } catch (error) {
    console.error('PayPal webhook verification error:', error)
    return false
  }
}

/**
 * Extract PayPal webhook headers from request headers
 */
export function extractPayPalHeaders(headers: Headers): Partial<PayPalWebhookHeaders> {
  return {
    'paypal-transmission-id': headers.get('paypal-transmission-id') || '',
    'paypal-transmission-time': headers.get('paypal-transmission-time') || '',
    'paypal-transmission-sig': headers.get('paypal-transmission-sig') || '',
    'paypal-cert-url': headers.get('paypal-cert-url') || '',
    'paypal-auth-algo': headers.get('paypal-auth-algo') || '',
  }
}

