-- Add 'cart' status to orders table
-- This allows using orders table as a persistent cart

-- Note: SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the table or use a migration approach
-- For D1, we can add the cart status by updating existing orders and allowing it in new inserts

-- Update any existing orders to ensure they don't have 'cart' status (safety check)
UPDATE orders SET status = 'pending' WHERE status = 'cart';

-- The CHECK constraint will be updated in the main schema.sql file
-- For existing databases, this migration ensures data consistency

