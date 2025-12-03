# D1 Database Schema & Migrations

## Overview

This directory contains the D1 database schema and migrations for Dragon Station 2026. D1 is Cloudflare's SQLite-based database that runs at the edge.

## Schema File

The main schema is defined in `schema.sql`. This file contains:
- All table definitions
- Indexes for performance
- Foreign key constraints
- CHECK constraints for data validation

## Creating the Database

### First Time Setup

1. **Create the D1 database:**
   ```bash
   wrangler d1 create dragon-station-db
   ```

2. **Copy the database ID** from the output. It will look like:
   ```
   ✅ Successfully created DB 'dragon-station-db' in region APAC
   Created your database using D1's new storage backend. The new storage backend is not yet recommended for production workloads, but backs up your data via snapshots to R2.
   
   [[d1_databases]]
   binding = "D1_DATABASE"
   database_name = "dragon-station-db"
   database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```

3. **Update `infra/wrangler.toml`:**
   - Paste the `database_id` into the `[[d1_databases]]` section
   - If you also got a `preview_database_id`, add it as `preview_database_id` for local development

## Running Migrations

### Local Development

For local development, use the local D1 database:

```bash
# Run migration against local database
npm run db:migrate
```

This runs the schema against your local D1 database (created automatically when you run `wrangler dev`).

### Production

For production, you need to run migrations against the remote database:

```bash
# Run migration against production database
npm run db:migrate:prod
```

**Important:** This will execute the schema against your production database. Make sure you have:
1. Backed up your database (if it has data)
2. Tested the migration locally first
3. Verified the database ID in `wrangler.toml` is correct

### Manual Migration

You can also run migrations manually:

```bash
# Local
wrangler d1 execute dragon-station-db --file=./infra/db/schema.sql

# Production (remote)
wrangler d1 execute dragon-station-db --remote --file=./infra/db/schema.sql
```

## Migration Files

The `migrations/` directory contains incremental migration files for schema changes:

- `add_role_to_users.sql` - Adds role column to users table
- `add_password_resets_table.sql` - Creates password_resets table for password reset functionality

### Running Individual Migrations

```bash
# Local
wrangler d1 execute dragon-station-db --file=./infra/db/migrations/add_role_to_users.sql

# Production
wrangler d1 execute dragon-station-db --remote --file=./infra/db/migrations/add_role_to_users.sql
```

## Schema Details

### Key Features

- **IDs**: `INTEGER PRIMARY KEY AUTOINCREMENT`
- **Strings**: `TEXT`
- **Numbers**: `INTEGER`
- **Booleans**: `INTEGER` (0 = false, 1 = true)
- **Timestamps**: `INTEGER` (Unix timestamps)
- **Money**: `INTEGER` (stored in cents)

### Tables

1. **users** - User accounts (admin and customers)
2. **products** - Product catalog
3. **product_files** - Digital product file metadata
4. **inventory_items** - License codes/cards inventory
5. **orders** - Order management
6. **order_items** - Order line items
7. **payments** - Payment transaction records
8. **downloads** - Download link tracking
9. **support_tickets** - Customer support tickets
10. **password_resets** - Password reset tokens

## Database Management

### Viewing Database Info

```bash
# List all D1 databases
wrangler d1 list

# Get database info
wrangler d1 info dragon-station-db
```

### Querying the Database

```bash
# Execute a query locally
wrangler d1 execute dragon-station-db --command "SELECT * FROM users LIMIT 10"

# Execute a query in production
wrangler d1 execute dragon-station-db --remote --command "SELECT * FROM users LIMIT 10"
```

### Backups

D1 automatically backs up your data via snapshots to R2. You can also export data:

```bash
# Export database
wrangler d1 export dragon-station-db --output=./backup.sql

# Import database (local only)
wrangler d1 execute dragon-station-db --file=./backup.sql
```

## Troubleshooting

### Database Not Found

If you get "database not found" errors:
1. Verify the database exists: `wrangler d1 list`
2. Check the `database_id` in `wrangler.toml` matches the actual database ID
3. Make sure you're using the correct database name

### Migration Errors

If migrations fail:
1. Check the SQL syntax in `schema.sql`
2. Verify you're running against the correct database (local vs remote)
3. Check for existing data conflicts
4. Review D1 logs: `wrangler tail`

## Production Checklist

Before running migrations in production:

- [ ] Database ID is correctly set in `wrangler.toml`
- [ ] Schema has been tested locally
- [ ] Backup strategy is in place
- [ ] Migration has been reviewed
- [ ] Rollback plan is documented
