-- Add Coupons Table and Extend Orders Table Migration
-- Creates the coupons table and adds coupon-related columns to orders

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
  amount INTEGER NOT NULL,
  currency TEXT,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER,
  min_order_amount INTEGER,
  starts_at INTEGER,
  ends_at INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- Add coupon columns to orders table
-- Note: If columns already exist, these will fail silently in SQLite
-- For production, you may want to check first or use ALTER TABLE IF NOT EXISTS pattern
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll add them conditionally

-- Add coupon_code column
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so this may fail if column exists
-- In that case, you can manually verify and skip
ALTER TABLE orders ADD COLUMN coupon_code TEXT;

-- Add discount_amount column
ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0;

-- Add subtotal_amount column
ALTER TABLE orders ADD COLUMN subtotal_amount INTEGER;

-- Add total_amount column
ALTER TABLE orders ADD COLUMN total_amount INTEGER;

-- Note: For existing orders, you may want to backfill:
-- UPDATE orders SET subtotal_amount = amount, total_amount = amount WHERE subtotal_amount IS NULL;

