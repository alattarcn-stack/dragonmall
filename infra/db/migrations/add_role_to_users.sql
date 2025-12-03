-- Migration: Add role column to users table
-- Run this if your database already exists and doesn't have the role column

-- Add role column if it doesn't exist
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- This will fail if column already exists, which is fine
ALTER TABLE users ADD COLUMN role TEXT CHECK(role IN ('admin', 'customer')) DEFAULT 'admin';

-- Update existing users to have admin role if they don't have one
UPDATE users SET role = 'admin' WHERE role IS NULL;

