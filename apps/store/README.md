# Dragon Station Storefront

Modern Next.js 14 storefront for Dragon Station 2026.

## Features

- **Landing Page** (`/`) - Hero section with featured products grid
- **Products Listing** (`/products`) - Full product catalog
- **Product Detail** (`/products/[slug]`) - Individual product pages with buy button
- **Checkout** (`/checkout/[orderId]`) - Order checkout page
- **Order Success** (`/order/success/[orderId]`) - Order confirmation with downloads/keys

## Tech Stack

- Next.js 14 App Router
- TypeScript
- TailwindCSS
- shadcn/ui components
- React Server Components

## Components

### UI Components (shadcn/ui)
- `Button` - Styled button component
- `Card` - Card container with header, content, footer

### Custom Components
- `ProductCard` - Product card for grid display
- `BuyButton` - Buy now button with order creation
- `CheckoutForm` - Payment form (Stripe placeholder)
- `OrderSuccessContent` - Success page content with downloads/keys
- `Header` - Site header with navigation
- `Footer` - Site footer

## API Integration

Uses `@dragon/api` package for all API calls:

- `getProducts()` - Fetch product list
- `getProduct(slug)` - Fetch single product
- `createDraftOrder()` - Create new order
- `getOrder(orderId)` - Fetch order details

## Environment Variables

Set `NEXT_PUBLIC_API_URL` to point to your Workers API (defaults to `http://localhost:8787`).

## Development

```bash
npm run dev
```

Runs on `http://localhost:3000`

## Pages

### `/` - Landing Page
- Hero section describing Dragon Station 2026
- Featured products grid (6 products)
- "Browse Products" CTA

### `/products` - Products Listing
- Full product catalog
- Grid layout with product cards
- Responsive design

### `/products/[slug]` - Product Detail
- Product image, title, description
- Price and product type badge
- Product details (stock, quantity limits)
- "Buy Now" button

### `/checkout/[orderId]` - Checkout
- Order summary
- Payment form (Stripe placeholder)
- Order details

### `/order/success/[orderId]` - Success Page
- Order confirmation
- Download links (for digital products)
- License codes (for license code products)
- Copy to clipboard functionality

## Next Steps

- [ ] Implement proper email input form (replace prompt)
- [ ] Add Stripe payment integration
- [ ] Add PayPal payment option
- [ ] Implement user authentication
- [ ] Add shopping cart functionality
- [ ] Add product search/filtering
- [ ] Add dark mode toggle
- [ ] Add loading states and skeletons
- [ ] Add error boundaries

