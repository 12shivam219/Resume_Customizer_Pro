#!/usr/bin/env node

/**
 * Test database connection script
 * Usage: node scripts/test-db-connection.js
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config();

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  // Extract hostname from DATABASE_URL for debugging
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`📡 Attempting to connect to: ${url.hostname}`);
    console.log(`🔗 Database: ${url.pathname.slice(1)}`);
    console.log(`👤 User: ${url.username}`);
  } catch (e) {
    console.error('❌ Invalid DATABASE_URL format:', e.message);
    process.exit(1);
  }

  try {
    // Test connection using Neon's HTTP adapter
    const sql = neon(process.env.DATABASE_URL);
    
    console.log('⏳ Testing connection...');
    const result = await sql`SELECT NOW() as current_time, version() as postgres_version`;
    
    console.log('✅ Database connection successful!');
    console.log(`📅 Current time: ${result[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${result[0].postgres_version}`);
    
    // Test if our main tables exist
    console.log('\n🔍 Checking database schema...');
    try {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      
      console.log(`📊 Found ${tables.length} tables:`);
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
      
    } catch (schemaError) {
      console.warn('⚠️ Could not check schema (database might be empty):', schemaError.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Possible solutions:');
      console.error('   1. Check if your Neon database is active (not paused)');
      console.error('   2. Verify the DATABASE_URL is correct');
      console.error('   3. Check your internet connection');
      console.error('   4. The database might have been deleted');
    }
    
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection().catch(console.error);
