-- Dragon Station 2026 - D1 Database Schema
-- Simplified from original MySQL schema (shua_*) for single-store platform
-- SQLite/D1 compatible

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Single-store user management (simplified from legacy multi-site system)
-- Kept: email, password, basic user info, status
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'customer')) DEFAULT 'admin',
  is_active INTEGER NOT NULL DEFAULT 1, -- 0 = disabled, 1 = enabled
  created_at INTEGER NOT NULL, -- Unix timestamp
  last_login_at INTEGER -- Unix timestamp
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
-- Product categories for organizing products
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 10,
  is_active INTEGER NOT NULL DEFAULT 1, -- 0 = inactive, 1 = active
  created_at INTEGER NOT NULL, -- Unix timestamp
  updated_at INTEGER NOT NULL -- Unix timestamp
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active);

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
-- Product catalog for single-store platform
-- Kept: name, description, price, stock, category, images, product type
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  images TEXT, -- JSON array of image URLs
  price INTEGER NOT NULL, -- Price in cents
  stock INTEGER, -- NULL = unlimited stock
  category_id INTEGER NOT NULL DEFAULT 0, -- 0 = uncategorized
  is_active INTEGER NOT NULL DEFAULT 1, -- 0 = inactive, 1 = active
  min_quantity INTEGER NOT NULL DEFAULT 1,
  max_quantity INTEGER, -- NULL = no limit
  product_type TEXT NOT NULL CHECK(product_type IN ('digital', 'license_code')), -- digital = file download, license_code = uses inventory_items
  sort_order INTEGER NOT NULL DEFAULT 10,
  created_at INTEGER NOT NULL -- Unix timestamp
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_type ON products(product_type);

-- ============================================================================
-- REFUNDS TABLE
-- ============================================================================
-- Tracks refunds for payments
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  amount INTEGER NOT NULL, -- Refund amount in cents
  currency TEXT NOT NULL, -- ISO 4217 code
  provider TEXT NOT NULL CHECK(provider IN ('stripe', 'paypal')),
  provider_refund_id TEXT, -- External refund ID from provider
  status TEXT NOT NULL CHECK(status IN ('pending', 'succeeded', 'failed')),
  reason TEXT, -- Optional refund reason
  created_at INTEGER NOT NULL, -- Unix timestamp
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_order ON refunds(order_id);
CREATE INDEX idx_refunds_status ON refunds(status);

-- ============================================================================
-- PRODUCT FILES TABLE
-- ============================================================================
-- New table for digital product file metadata
-- Links to R2 bucket keys for file storage
CREATE TABLE IF NOT EXISTS product_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  r2_key TEXT NOT NULL, -- R2 object key
  file_name TEXT NOT NULL,
  file_size INTEGER, -- Size in bytes
  mime_type TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER, -- NULL = unlimited
  expires_at INTEGER, -- Unix timestamp, NULL = never expires
  created_at INTEGER NOT NULL, -- Unix timestamp
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_files_product ON product_files(product_id);
CREATE INDEX idx_product_files_r2_key ON product_files(r2_key);

-- ============================================================================
-- INVENTORY ITEMS TABLE (License Codes/Cards)
-- ============================================================================
-- Maps from: shua_faka (simplified - removed supplier_id)
-- Kept: product_id, license_code, password, order_id (allocation)
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  license_code TEXT NOT NULL,
  password TEXT, -- Optional password for the code
  order_id INTEGER, -- NULL = unused, set when allocated to order
  created_at INTEGER NOT NULL, -- Unix timestamp
  allocated_at INTEGER, -- Unix timestamp when allocated to order
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX idx_inventory_product ON inventory_items(product_id);
CREATE INDEX idx_inventory_order ON inventory_items(order_id);
CREATE INDEX idx_inventory_unused ON inventory_items(product_id, order_id) WHERE order_id IS NULL;

-- ============================================================================
-- COUPONS TABLE
-- ============================================================================
-- Discount codes for orders
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE, -- Stored in uppercase
  type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
  amount INTEGER NOT NULL, -- Percentage (0-100) or fixed amount in cents
  currency TEXT, -- ISO 4217 code or NULL for "all"
  max_uses INTEGER, -- NULL = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER, -- NULL = unlimited per user
  min_order_amount INTEGER, -- Minimum order amount in cents, NULL = no minimum
  starts_at INTEGER, -- Unix timestamp, NULL = no start date
  ends_at INTEGER, -- Unix timestamp, NULL = no end date
  is_active INTEGER NOT NULL DEFAULT 1, -- 0 = inactive, 1 = active
  created_at INTEGER NOT NULL, -- Unix timestamp
  updated_at INTEGER NOT NULL -- Unix timestamp
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
-- Order management for single-store platform
-- Kept: product_id, user_id, quantity, amount, status, customer_data, fulfillment_result
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, -- NULL = guest order
  customer_email TEXT NOT NULL, -- Required for all orders
  customer_data TEXT, -- JSON object with custom fields (input, input2, etc.)
  quantity INTEGER NOT NULL DEFAULT 1,
  amount INTEGER NOT NULL, -- Total amount in cents (kept for backward compatibility)
  coupon_code TEXT, -- Applied coupon code
  discount_amount INTEGER NOT NULL DEFAULT 0, -- Discount amount in cents
  subtotal_amount INTEGER, -- Amount before discount in cents
  total_amount INTEGER, -- Final amount after discount in cents
  status TEXT NOT NULL CHECK(status IN ('cart', 'pending', 'processing', 'completed', 'cancelled', 'refunded')),
  fulfillment_result TEXT, -- License codes, download links, or fulfillment message
  created_at INTEGER NOT NULL, -- Unix timestamp
  completed_at INTEGER, -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_email ON orders(customer_email);

-- ============================================================================
-- ORDER ITEMS TABLE
-- ============================================================================
-- New table to support multiple products per order (for future cart functionality)
-- Currently: one order = one product, but structure allows expansion
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL, -- Price per unit in cents (snapshot at time of order)
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
-- Payment processing for single-store platform
-- Enhanced for Stripe/PayPal with currency and payment method details
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_number TEXT UNIQUE NOT NULL, -- Internal transaction ID
  external_transaction_id TEXT, -- Stripe PaymentIntent ID or PayPal Order ID
  user_id INTEGER, -- NULL = guest payment
  order_id INTEGER, -- Link to order
  product_id INTEGER, -- Optional direct product link
  amount INTEGER NOT NULL, -- Amount in cents (or smallest currency unit)
  currency TEXT NOT NULL DEFAULT 'usd', -- ISO 4217 currency code (usd, eur, gbp, etc.)
  method TEXT NOT NULL CHECK(method IN ('stripe', 'paypal')),
  status TEXT NOT NULL CHECK(status IN ('unpaid', 'paid', 'refunded', 'failed')),
  payment_method_type TEXT, -- card, apple_pay, google_pay, paypal, etc.
  metadata TEXT, -- JSON string for additional payment data
  ip_address TEXT, -- Customer IP address
  created_at INTEGER NOT NULL, -- Unix timestamp
  paid_at INTEGER, -- Unix timestamp when payment completed
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX idx_payments_transaction ON payments(transaction_number);
CREATE INDEX idx_payments_external ON payments(external_transaction_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================================================
-- DOWNLOADS TABLE
-- ============================================================================
-- New table for tracking digital product downloads
-- Maps from concept: download_records (from domain model)
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  user_id INTEGER, -- NULL for guest downloads
  product_id INTEGER NOT NULL,
  product_file_id INTEGER, -- Link to specific file if multiple files per product
  download_url TEXT NOT NULL, -- R2 public URL or signed URL
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER, -- NULL = unlimited
  expires_at INTEGER, -- Unix timestamp, NULL = never expires
  created_at INTEGER NOT NULL, -- Unix timestamp
  last_downloaded_at INTEGER, -- Unix timestamp
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (product_file_id) REFERENCES product_files(id) ON DELETE SET NULL
);

CREATE INDEX idx_downloads_order ON downloads(order_id);
CREATE INDEX idx_downloads_user ON downloads(user_id);
CREATE INDEX idx_downloads_product ON downloads(product_id);

-- ============================================================================
-- SUPPORT TICKETS TABLE
-- ============================================================================
-- Support ticket system for single-store platform
-- Kept: user_id, order_id, content, reply, status
CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_id INTEGER, -- Optional link to related order
  content TEXT NOT NULL,
  reply TEXT, -- Admin reply
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed')),
  created_at INTEGER NOT NULL, -- Unix timestamp
  replied_at INTEGER, -- Unix timestamp when admin replied
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX idx_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_tickets_order ON support_tickets(order_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_created ON support_tickets(created_at);

-- ============================================================================
-- PASSWORD RESETS TABLE
-- ============================================================================
-- Stores temporary tokens for password reset functionality
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL, -- Unix timestamp
  created_at INTEGER NOT NULL, -- Unix timestamp
  used_at INTEGER, -- Unix timestamp when token was used, NULL = not used
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);
CREATE INDEX idx_password_resets_expires ON password_resets(expires_at);
