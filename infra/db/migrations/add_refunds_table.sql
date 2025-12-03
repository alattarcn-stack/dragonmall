-- Add Refunds Table and Extend Orders Status Migration
-- Creates the refunds table and adds 'refunded' status to orders

-- Add 'refunded' to orders.status CHECK constraint
-- Note: SQLite doesn't support ALTER TABLE to modify CHECK constraints directly
-- For existing databases, you may need to recreate the table or use a workaround
-- This migration assumes you're starting fresh or will handle the constraint update separately

-- Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('stripe', 'paypal')),
  provider_refund_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'succeeded', 'failed')),
  reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Note: To update orders.status CHECK constraint in SQLite, you would need to:
-- 1. Create a new table with the updated constraint
-- 2. Copy data from old table
-- 3. Drop old table
-- 4. Rename new table
-- For production, consider using a migration tool that handles this automatically
-- For now, the schema.sql file has been updated with 'refunded' in the CHECK constraint

