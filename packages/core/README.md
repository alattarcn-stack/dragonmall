# @dragon/core

Core domain types and services for Dragon Station 2026.

## Types

All domain types are defined in `src/types.ts`:

- `User` - User accounts
- `Product` - Products
- `ProductFile` - Digital product file metadata
- `Order` - Orders
- `OrderItem` - Order line items
- `Payment` - Payment transactions
- `InventoryItem` - License codes/cards
- `DownloadRecord` - Download tracking
- `SupportTicket` - Support tickets

## Services

All services accept a `D1Database` instance in their constructor and use it for all database operations.

### UserService

- `getById(id: number)` - Get user by ID
- `getByEmail(email: string)` - Get user by email
- `create(user)` - Create new user
- `update(id, updates)` - Update user
- `updateLastLogin(id)` - Update last login timestamp

### ProductService

- `getById(id: number)` - Get product by ID
- `getBySlug(slug: string)` - Get product by slug (currently uses ID)
- `listProducts(options?)` - List products with filters
- `create(product)` - Create new product
- `update(id, updates)` - Update product
- `delete(id)` - Delete product
- `checkStock(productId, quantity)` - Check if product has sufficient stock

### OrderService

- `getById(id: number)` - Get order by ID
- `getByUserId(userId: number)` - Get orders for a user
- `getByEmail(email: string)` - Get orders by customer email
- `createDraftOrder(request)` - Create a new draft order
- `getOrderItems(orderId)` - Get items for an order
- `updateStatus(id, status)` - Update order status
- `markPaid(orderId)` - Mark order as paid
- `updateFulfillmentResult(id, result)` - Update fulfillment result

### PaymentService

- `getById(id: number)` - Get payment by ID
- `getByTransactionNumber(transactionNumber)` - Get payment by transaction number
- `getByOrderId(orderId)` - Get payment for an order
- `createPaymentIntent(request)` - Create a payment intent
- `confirmPayment(transactionNumber, externalId?)` - Confirm payment
- `refund(transactionNumber)` - Refund a payment

### InventoryService

- `getAvailableByProductId(productId)` - Get available inventory items
- `getCountByProductId(productId)` - Get count of available items
- `allocateCode(productId, orderId, quantity)` - Allocate codes to an order
- `addItems(productId, items)` - Add new inventory items
- `getByOrderId(orderId)` - Get items allocated to an order

### DownloadService

- `createDownloadLink(orderId, productId, userId?, productFileId?)` - Create download record
- `getByOrderId(orderId)` - Get downloads for an order
- `recordDownload(downloadId)` - Record a download
- `validateDownload(downloadId)` - Validate download is still valid

### SupportService

- `getById(id: number)` - Get ticket by ID
- `getByUserId(userId)` - Get tickets for a user
- `getByOrderId(orderId)` - Get tickets for an order
- `getAll(options?)` - Get all tickets with filters
- `create(ticket)` - Create new ticket
- `reply(id, reply)` - Reply to a ticket
- `updateStatus(id, status)` - Update ticket status

## Usage

```typescript
import { ProductService } from '@dragon/core'

const productService = new ProductService(env.D1_DATABASE)
const products = await productService.listProducts({ isActive: true })
```

## Notes

- All timestamps are Unix timestamps (seconds since epoch)
- All money amounts are in cents (INTEGER)
- Boolean values use INTEGER (0 = false, 1 = true)
- Services throw errors on failures - handle with try/catch

