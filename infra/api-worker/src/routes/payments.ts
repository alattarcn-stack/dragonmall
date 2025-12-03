import { Hono } from 'hono'
import type { Env } from '../types'
import { PaymentService, OrderService, InventoryService, DownloadService, ProductService } from '@dragon/core'
import { StripeCreateIntentSchema, PayPalCreateOrderSchema, formatValidationError } from '../validation/schemas'
import { sendOrderConfirmationEmail } from '../utils/email'
import { logError, logInfo } from '../utils/logging'
import { verifyPayPalWebhook, extractPayPalHeaders } from '../utils/paypal-webhook'
import { makeError, ErrorCodes } from '../utils/errors'
import Stripe from 'stripe'
import paypal from '@paypal/checkout-server-sdk'

export function createPaymentsRouter(env: Env) {
  const router = new Hono<{ Bindings: Env }>()
  const paymentService = new PaymentService(env.D1_DATABASE)
  const orderService = new OrderService(env.D1_DATABASE)
  const inventoryService = new InventoryService(env.D1_DATABASE)
  const downloadService = new DownloadService(env.D1_DATABASE, env.R2_BUCKET)

  // Initialize Stripe
  const stripe = env.STRIPE_SECRET_KEY
    ? new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-11-20.acacia',
      })
    : null

  // Initialize PayPal
  let paypalClient: paypal.core.PayPalHttpClient | null = null
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
    const environment = env.ENVIRONMENT === 'production'
      ? new paypal.core.LiveEnvironment(env.PAYPAL_CLIENT_ID, env.PAYPAL_CLIENT_SECRET)
      : new paypal.core.SandboxEnvironment(env.PAYPAL_CLIENT_ID, env.PAYPAL_CLIENT_SECRET)
    paypalClient = new paypal.core.PayPalHttpClient(environment)
  }

  // Helper: Fulfill order after payment
  async function fulfillOrder(orderId: number) {
    const order = await orderService.getById(orderId)
    if (!order) {
      throw new Error('Order not found')
    }

    // Get order items
    const orderItems = await orderService.getOrderItems(orderId)
    
    let fulfillmentResults: string[] = []
    const products: Array<{ name: string; quantity: number }> = []
    const downloadLinks: Array<{ productName: string; url: string; expiresAt?: number }> = []

    for (const item of orderItems) {
      // Get product to check type
      const productService = new ProductService(env.D1_DATABASE)
      const product = await productService.getById(item.productId)
      if (!product) continue

      products.push({
        name: product.name,
        quantity: item.quantity,
      })

      if (product.productType === 'license_code') {
        // Allocate license codes
        const codes = await inventoryService.allocateCode(
          item.productId,
          orderId,
          item.quantity
        )
        
        if (codes.length > 0) {
          const codeList = codes.map((c: any) => {
            // Handle both snake_case (from DB) and camelCase (from service)
            const code = c.license_code || c.licenseCode || ''
            const pass = c.password || null
            return pass ? `${code}:${pass}` : code
          }).join('\n')
          fulfillmentResults.push(`License Codes:\n${codeList}`)
        }
      } else if (product.productType === 'digital') {
        // Create download links
        const downloadRecord = await downloadService.createDownloadLink(
          orderId,
          item.productId,
          order.userId || undefined
        )
        
        if (downloadRecord) {
          fulfillmentResults.push(`Download: ${downloadRecord.downloadUrl}`)
          downloadLinks.push({
            productName: product.name,
            url: downloadRecord.downloadUrl,
            expiresAt: downloadRecord.expiresAt || undefined,
          })
        }
      }
    }

    // Update order with fulfillment result and status atomically
    const fulfillmentText = fulfillmentResults.join('\n\n')
    await orderService.fulfillOrder(orderId, fulfillmentText)

    // Send order confirmation email
    if (order.customerEmail) {
      try {
        // Use total_amount if available, otherwise fall back to amount
        const orderAmount = order.totalAmount ?? order.amount
        await sendOrderConfirmationEmail(
          order.customerEmail,
          {
            id: order.id,
            orderNumber: `#${order.id}`,
            products,
            amount: orderAmount,
            downloadLinks: downloadLinks.length > 0 ? downloadLinks : undefined,
          },
          env
        )
        logInfo('Order confirmation email sent', { orderId, email: order.customerEmail }, env)
      } catch (emailError) {
        logError('Failed to send order confirmation email', emailError, { orderId, email: order.customerEmail }, env)
        // Don't fail the fulfillment if email fails
      }
    }
  }

  // POST /api/payments/stripe/create-intent
  router.post('/stripe/create-intent', async (c) => {
    try {
      if (!stripe) {
        return c.json({ error: 'Stripe not configured' }, 500)
      }

      const body = await c.req.json()

      // Validate input
      const validationResult = StripeCreateIntentSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { orderId, currency } = validationResult.data

      // Fetch order fresh from database to get authoritative amount
      // Never trust client-provided amounts - always use database values
      const order = await orderService.getById(orderId)
      if (!order) {
        return c.json({ error: 'Order not found' }, 404)
      }

      if (order.status !== 'pending') {
        return c.json({ error: 'Order is not pending' }, 400)
      }

      // Get authoritative order amount from database (total_amount includes discounts)
      // This ensures we always use the correct amount, regardless of what the client sends
      const orderAmount = order.totalAmount ?? order.amount

      // Get client IP
      const ipAddress = c.req.header('CF-Connecting-IP') || 
                       c.req.header('X-Forwarded-For')?.split(',')[0] ||
                       'unknown'

      // Create payment record (PaymentService also fetches order amount from DB)
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'stripe',
        currency,
        ipAddress,
      })

      // Verify payment record amount matches order amount (defense in depth)
      if (payment.amount !== orderAmount) {
        logError('Payment amount mismatch during creation', {
          orderId,
          orderAmount,
          paymentAmount: payment.amount,
        })
        return c.json(makeError(ErrorCodes.PAYMENT_AMOUNT_MISMATCH, 'Payment amount validation failed', { orderAmount, paymentAmount: payment.amount }), 500)
      }

      // Create Stripe PaymentIntent with authoritative amount from database
      const paymentIntent = await stripe.paymentIntents.create({
        amount: orderAmount, // Always use database amount, never client input
        currency: currency.toLowerCase(),
        metadata: {
          orderId: orderId.toString(),
          transactionNumber: payment.transactionNumber,
        },
        automatic_payment_methods: {
          enabled: true, // Enables Apple Pay, Google Pay, etc.
        },
      })

      // Update payment with Stripe PaymentIntent ID
      await paymentService.updateExternalTransactionId(
        payment.transactionNumber,
        paymentIntent.id
      )

      return c.json({
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentId: payment.id,
          transactionNumber: payment.transactionNumber,
        },
      })
    } catch (error: any) {
      console.error('Error creating Stripe payment intent:', error)
      return c.json(makeError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create payment intent',
        env.ENVIRONMENT === 'development' ? { originalError: error.message } : undefined
      ), 500)
    }
  })

  // POST /api/payments/stripe/webhook
  router.post('/stripe/webhook', async (c) => {
    try {
      if (!stripe) {
        return c.json(makeError(ErrorCodes.CONFIGURATION_ERROR, 'Stripe not configured'), 500)
      }

      const signature = c.req.header('stripe-signature')
      if (!signature) {
        return c.json(makeError(ErrorCodes.BAD_REQUEST, 'Missing stripe-signature header'), 400)
      }

      const body = await c.req.text()
      const webhookSecret = env.STRIPE_WEBHOOK_SECRET

      if (!webhookSecret) {
        return c.json(makeError(ErrorCodes.CONFIGURATION_ERROR, 'Stripe webhook secret not configured'), 500)
      }

      let event: Stripe.Event
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        return c.json(makeError(ErrorCodes.BAD_REQUEST, 'Invalid signature'), 400)
      }

      // Handle payment intent events
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = parseInt(paymentIntent.metadata.orderId || '0', 10)
        const transactionNumber = paymentIntent.metadata.transactionNumber

        if (orderId && transactionNumber) {
          // Validate payment amount matches order amount
          const order = await orderService.getById(orderId)
          if (!order) {
            logError('Order not found for payment intent', { orderId, transactionNumber })
            return c.json(makeError(ErrorCodes.NOT_FOUND, 'Order not found'), 404)
          }

          // Get authoritative order amount (total_amount includes discounts)
          const expectedAmount = order.totalAmount ?? order.amount
          
          // Verify payment intent amount matches order amount
          if (paymentIntent.amount !== expectedAmount) {
            logError('Payment amount mismatch', {
              orderId,
              transactionNumber,
              expectedAmount,
              paymentIntentAmount: paymentIntent.amount,
            })
            return c.json(makeError(ErrorCodes.PAYMENT_AMOUNT_MISMATCH, 'Payment amount does not match order amount', { expectedAmount, receivedAmount: paymentIntent.amount }), 400)
          }

          // Confirm payment
          await paymentService.confirmPayment(transactionNumber, paymentIntent.id)

          // Mark order as paid
          await orderService.markPaid(orderId)

          // Fulfill order (allocate codes, create downloads)
          await fulfillOrder(orderId)
        }
      } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const transactionNumber = paymentIntent.metadata.transactionNumber

        if (transactionNumber) {
          await paymentService.updatePaymentStatus(transactionNumber, 'failed')
        }
      }

      return c.json({ received: true })
    } catch (error: any) {
      console.error('Error processing Stripe webhook:', error)
      return c.json(makeError(
        ErrorCodes.INTERNAL_ERROR,
        'Webhook processing failed',
        env.ENVIRONMENT === 'development' ? { originalError: error.message } : undefined
      ), 500)
    }
  })

  // POST /api/payments/paypal/create-order
  router.post('/paypal/create-order', async (c) => {
    try {
      if (!paypalClient) {
        return c.json(makeError(ErrorCodes.CONFIGURATION_ERROR, 'PayPal not configured'), 500)
      }

      const body = await c.req.json()

      // Validate input
      const validationResult = PayPalCreateOrderSchema.safeParse(body)
      if (!validationResult.success) {
        return c.json(formatValidationError(validationResult.error), 400)
      }

      const { orderId, currency } = validationResult.data

      // Fetch order fresh from database to get authoritative amount
      // Never trust client-provided amounts - always use database values
      const order = await orderService.getById(orderId)
      if (!order) {
        return c.json({ error: 'Order not found' }, 404)
      }

      if (order.status !== 'pending') {
        return c.json({ error: 'Order is not pending' }, 400)
      }

      // Get authoritative order amount from database (total_amount includes discounts)
      // This ensures we always use the correct amount, regardless of what the client sends
      const orderAmount = order.totalAmount ?? order.amount

      // Get client IP
      const ipAddress = c.req.header('CF-Connecting-IP') || 
                       c.req.header('X-Forwarded-For')?.split(',')[0] ||
                       'unknown'

      // Create payment record (PaymentService also fetches order amount from DB)
      const payment = await paymentService.createPaymentIntent({
        orderId,
        method: 'paypal',
        currency: currency.toLowerCase(),
        ipAddress,
      })

      // Verify payment record amount matches order amount (defense in depth)
      if (payment.amount !== orderAmount) {
        logError('Payment amount mismatch during creation', {
          orderId,
          orderAmount,
          paymentAmount: payment.amount,
        })
        return c.json(makeError(ErrorCodes.PAYMENT_AMOUNT_MISMATCH, 'Payment amount validation failed', { orderAmount, paymentAmount: payment.amount }), 500)
      }

      // Create PayPal order with authoritative amount from database
      const request = new paypal.orders.OrdersCreateRequest()
      request.prefer('return=representation')
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId.toString(),
          amount: {
            currency_code: currency.toUpperCase(),
            value: (orderAmount / 100).toFixed(2), // Always use database amount, never client input
          },
          description: `Order #${orderId}`,
        }],
        application_context: {
          return_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/order/success/${orderId}`,
          cancel_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${orderId}`,
        },
      })

      const paypalOrder = await paypalClient.execute(request)

      // Update payment with PayPal order ID
      await paymentService.updateExternalTransactionId(
        payment.transactionNumber,
        paypalOrder.result.id
      )

      // Find approval URL
      const approvalUrl = paypalOrder.result.links?.find(
        (link: any) => link.rel === 'approve'
      )?.href || ''

      return c.json({
        data: {
          orderId: paypalOrder.result.id,
          paymentId: payment.id,
          transactionNumber: payment.transactionNumber,
          approvalUrl,
        },
      })
    } catch (error: any) {
      console.error('Error creating PayPal order:', error)
      return c.json(makeError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create PayPal order',
        env.ENVIRONMENT === 'development' ? { originalError: error.message } : undefined
      ), 500)
    }
  })

  // POST /api/payments/paypal/webhook
  router.post('/paypal/webhook', async (c) => {
    try {
      if (!paypalClient) {
        return c.json(makeError(ErrorCodes.CONFIGURATION_ERROR, 'PayPal not configured'), 500)
      }

      // Verify webhook signature
      if (!env.PAYPAL_WEBHOOK_ID) {
        logError('PayPal webhook ID not configured', {})
        return c.json(makeError(ErrorCodes.CONFIGURATION_ERROR, 'Webhook verification not configured'), 500)
      }

      if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
        logError('PayPal credentials not configured for webhook verification', {})
        return c.json(makeError(ErrorCodes.CONFIGURATION_ERROR, 'PayPal credentials not configured'), 500)
      }

      // Get raw body as text (required for signature verification)
      const rawBody = await c.req.text()
      
      // Extract PayPal webhook headers
      const paypalHeaders = extractPayPalHeaders(c.req.raw.headers)
      
      // Verify webhook signature using PayPal's verification API
      const isProduction = env.ENVIRONMENT === 'production'
      const isValid = await verifyPayPalWebhook(
        rawBody,
        paypalHeaders as any,
        env.PAYPAL_WEBHOOK_ID,
        env.PAYPAL_CLIENT_ID,
        env.PAYPAL_CLIENT_SECRET,
        isProduction
      )

      if (!isValid) {
        logError('PayPal webhook signature verification failed', {
          transmissionId: paypalHeaders['paypal-transmission-id'],
        })
        return c.json(makeError(ErrorCodes.UNAUTHORIZED, 'Invalid webhook signature'), 401)
      }

      // Parse body as JSON after verification
      const body = JSON.parse(rawBody)
      const eventType = body.event_type

      logInfo('PayPal webhook received', {
        eventType,
        transmissionId: paypalHeaders['paypal-transmission-id'],
      })

      // Handle payment capture events
      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const resource = body.resource
        const paypalOrderId = resource.supplementary_data?.related_ids?.order_id

        if (paypalOrderId) {
          // Find payment by PayPal order ID
          const payment = await paymentService.getByExternalTransactionId(paypalOrderId)
          
          if (payment && payment.orderId) {
            // Validate payment amount matches order amount
            const order = await orderService.getById(payment.orderId)
            if (!order) {
              logError('Order not found for PayPal payment', {
                orderId: payment.orderId,
                paypalOrderId,
              })
              return c.json(makeError(ErrorCodes.NOT_FOUND, 'Order not found'), 404)
            }

            // Get authoritative order amount (total_amount includes discounts)
            const expectedAmount = order.totalAmount ?? order.amount
            
            // PayPal amounts are in dollars, convert to cents for comparison
            const captureAmountCents = Math.round(parseFloat(resource.amount.value || '0') * 100)
            
            // Verify capture amount matches order amount
            if (captureAmountCents !== expectedAmount) {
              logError('PayPal payment amount mismatch', {
                orderId: payment.orderId,
                transactionNumber: payment.transactionNumber,
                expectedAmount,
                captureAmountCents,
                captureAmount: resource.amount.value,
              })
              return c.json(makeError(ErrorCodes.PAYMENT_AMOUNT_MISMATCH, 'Payment amount does not match order amount', { expectedAmount, receivedAmount: captureAmountCents }), 400)
            }

            // Confirm payment
            await paymentService.confirmPayment(
              payment.transactionNumber,
              resource.id
            )

            // Mark order as paid
            await orderService.markPaid(payment.orderId)

            // Fulfill order
            await fulfillOrder(payment.orderId)

            logInfo('PayPal payment processed successfully', {
              paymentId: payment.id,
              orderId: payment.orderId,
            })
          } else {
            logError('PayPal payment not found for order ID', {
              paypalOrderId,
            })
          }
        }
      }

      return c.json({ received: true })
    } catch (error: any) {
      logError('Error processing PayPal webhook', {
        error: error.message,
        stack: error.stack,
      })
      return c.json(makeError(
        ErrorCodes.INTERNAL_ERROR,
        'Webhook processing failed',
        env.ENVIRONMENT === 'development' ? { originalError: error.message } : undefined
      ), 500)
    }
  })

  return router
}

