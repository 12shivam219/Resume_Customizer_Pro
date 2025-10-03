#!/usr/bin/env node

/**
 * Test login functionality with wrong credentials
 */

async function testLogin() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('🔍 Testing login with wrong credentials...');
  
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Test-Script/1.0'
      },
      credentials: 'include',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'wrongpassword123'
      }),
    });

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`📄 Response Body: ${responseText}`);
    
    if (!response.ok) {
      console.log('✅ Response correctly indicates failure (not ok)');
      try {
        const errorData = JSON.parse(responseText);
        console.log('📊 Parsed Error Data:', errorData);
      } catch (e) {
        console.log('⚠️ Could not parse response as JSON');
      }
    } else {
      console.log('❌ Response incorrectly indicates success');
    }
    
  } catch (error) {
    console.error('❌ Network error during login test:', error.message);
  }
}

// Test with a valid email format but wrong password
async function testLoginValidEmail() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('\n🔍 Testing login with valid email format but wrong password...');
  
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Test-Script/1.0'
      },
      credentials: 'include',
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'WrongPassword123!'
      }),
    });

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📄 Response Body: ${responseText}`);
    
    if (!response.ok) {
      console.log('✅ Response correctly indicates failure');
      try {
        const errorData = JSON.parse(responseText);
        console.log('📊 Error Message:', errorData.message);
        console.log('📊 Success Flag:', errorData.success);
      } catch (e) {
        console.log('⚠️ Could not parse response as JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

async function runTests() {
  await testLogin();
  await testLoginValidEmail();
}

runTests().catch(console.error);
