# Dragon Station 2026 - Directory Structure

## Tree View

```
dragon-2026/
├── apps/                          # Next.js applications
│   ├── store/                     # Customer-facing storefront
│   │   ├── src/
│   │   │   └── app/               # Next.js 14 App Router
│   │   │       ├── layout.tsx     # Root layout
│   │   │       ├── page.tsx       # Homepage with hero + product grid
│   │   │       ├── products/      # Products listing page
│   │   │       └── globals.css    # Global styles + Tailwind
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── admin/                     # Admin panel
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx      # Admin layout with sidebar/topbar
│       │   │   ├── page.tsx       # Dashboard page
│       │   │   └── globals.css
│       │   └── components/
│       │       ├── Sidebar.tsx     # Navigation sidebar
│       │       └── Topbar.tsx     # Top navigation bar
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── tsconfig.json
│
├── packages/                       # Shared packages
│   ├── api/                       # API client & types
│   │   ├── src/
│   │   │   ├── index.ts          # Package exports
│   │   │   ├── types.ts          # API request/response types
│   │   │   └── client.ts          # HTTP client (fetch wrapper)
│   │   └── package.json
│   │
│   └── core/                      # Domain types & services
│       ├── src/
│       │   ├── index.ts          # Package exports
│       │   ├── types.ts           # Domain entities (User, Product, Order, etc.)
│       │   └── services/          # Service layer skeletons
│       │       ├── index.ts
│       │       ├── product.service.ts
│       │       ├── order.service.ts
│       │       ├── payment.service.ts
│       │       ├── user.service.ts
│       │       ├── inventory.service.ts
│       │       └── support.service.ts
│       └── package.json
│
├── infra/                         # Cloudflare infrastructure
│   ├── api-worker/                # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── index.ts          # Hono app with routes
│   │   │   └── types.ts           # Workers environment types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── db/                        # D1 database
│   │   ├── schema.sql             # Complete D1 schema
│   │   └── migrations/            # Migration files (future)
│   │
│   ├── wrangler.toml              # Cloudflare Workers config
│   └── README.md                  # Infrastructure setup guide
│
├── package.json                   # Root workspace config
├── tsconfig.json                  # Root TypeScript config
├── .gitignore
└── README.md                      # Project overview
```

## Directory Explanations

### `/apps/`
Contains the two Next.js 14+ applications:
- **store/**: Customer-facing e-commerce storefront with product browsing and purchasing
- **admin/**: Administrative panel for managing products, orders, users, and system settings

Both apps use:
- TypeScript for type safety
- TailwindCSS for styling
- Next.js 14 App Router for routing
- Shared packages (`@dragon/api`, `@dragon/core`) for business logic

### `/packages/`
Shared code used across applications:

- **api/**: 
  - HTTP client wrapper for API calls
  - Type definitions for API requests/responses
  - Error handling utilities
  
- **core/**:
  - Domain entity types (User, Product, Order, Payment, etc.)
  - Service layer interfaces (skeletons to be implemented)
  - Business logic that can be shared between frontend and backend

### `/infra/`
Cloudflare infrastructure configuration:

- **api-worker/**: 
  - Hono-based API server running on Cloudflare Workers
  - RESTful endpoints for products, orders, payments
  - Handles D1, R2, KV, and Queue bindings
  
- **db/**:
  - D1 SQLite schema definition
  - Migration files directory (for future schema changes)
  
- **wrangler.toml**:
  - Cloudflare Workers configuration
  - Bindings for D1, R2, KV, Queue
  - Environment variables

## Key Features

✅ **Monorepo**: Workspace-based structure for code sharing  
✅ **TypeScript**: Full type safety across all packages  
✅ **Modern Stack**: Next.js 14, Hono, Cloudflare Workers  
✅ **Cloudflare-Native**: D1, R2, KV, Queue bindings configured  
✅ **Shared Types**: Domain types in `@dragon/core`, API types in `@dragon/api`  
✅ **Ready for Development**: Basic layouts and routing in place  

## Next Steps

1. Install dependencies: `npm install`
2. Set up Cloudflare resources (see `infra/README.md`)
3. Implement service layer in `packages/core/src/services/`
4. Connect API worker to D1 database
5. Build out storefront and admin UI components

