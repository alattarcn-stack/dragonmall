#!/usr/bin/env node
/**
 * D1 Database Migration Script
 * 
 * This script applies the schema.sql to a D1 database.
 * Can be run locally with wrangler or in CI/CD.
 * 
 * Usage:
 *   npm run db:migrate:script
 *   npm run db:migrate (direct wrangler command - recommended)
 */

import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get __dirname for both CommonJS and ES modules
const getDirname = () => {
  try {
    return typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
  } catch {
    return process.cwd()
  }
}

const DATABASE_NAME = 'dragon-station-db'
const SCHEMA_FILE = resolve(getDirname(), 'schema.sql')
const ROOT_DIR = resolve(getDirname(), '../..')

async function main() {
  console.log('🚀 Starting D1 database migration...')
  console.log(`📄 Schema file: ${SCHEMA_FILE}`)
  console.log(`🗄️  Database: ${DATABASE_NAME}\n`)

  try {
    console.log('⏳ Executing schema...\n')
    
    execSync(
      `wrangler d1 execute ${DATABASE_NAME} --file=${SCHEMA_FILE} --remote=false`,
      { 
        stdio: 'inherit',
        cwd: ROOT_DIR
      }
    )
    
    console.log('\n✅ Migration completed successfully!')
    console.log('\n💡 To migrate remote database, run:')
    console.log(`   npm run db:migrate:remote`)

  } catch (error) {
    console.error('\n❌ Migration failed!')
    console.error('\n💡 Make sure:')
    console.error('   1. D1 database is created: wrangler d1 create dragon-station-db')
    console.error('   2. Database ID is set in wrangler.toml')
    console.error('   3. Wrangler is installed: npm install -g wrangler')
    console.error('\n💡 Or run directly:')
    console.error(`   wrangler d1 execute ${DATABASE_NAME} --file=${SCHEMA_FILE}`)
    throw error
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
