#!/usr/bin/env node

/**
 * Test different database connection variations
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

const originalUrl = process.env.DATABASE_URL;

// Different URL variations to try
const urlVariations = [
  {
    name: "Original URL",
    url: originalUrl
  },
  {
    name: "Without channel_binding",
    url: originalUrl?.replace('&channel_binding=require', '')
  },
  {
    name: "Only sslmode=require",
    url: originalUrl?.replace('?sslmode=require&channel_binding=require', '?sslmode=require')
  },
  {
    name: "Minimal (no SSL params)",
    url: originalUrl?.split('?')[0]
  }
];

async function testVariation(variation) {
  console.log(`\n🔍 Testing: ${variation.name}`);
  console.log(`🔗 URL: ${variation.url?.substring(0, 50)}...`);
  
  try {
    const sql = neon(variation.url);
    const result = await sql`SELECT NOW() as current_time`;
    console.log(`✅ SUCCESS: ${variation.name}`);
    console.log(`📅 Time: ${result[0].current_time}`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${variation.name}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testAllVariations() {
  console.log('🚀 Testing database connection variations...\n');
  
  for (const variation of urlVariations) {
    if (variation.url) {
      const success = await testVariation(variation);
      if (success) {
        console.log(`\n🎉 Found working connection: ${variation.name}`);
        console.log(`💡 Use this URL in your .env file:`);
        console.log(variation.url);
        return;
      }
    }
  }
  
  console.log('\n❌ All connection attempts failed.');
  console.log('\n💡 Possible solutions:');
  console.log('1. Check if your Neon database is paused - go to https://console.neon.tech/');
  console.log('2. Verify the database still exists');
  console.log('3. Check if the connection string has changed');
  console.log('4. Try creating a new database');
}

testAllVariations().catch(console.error);
