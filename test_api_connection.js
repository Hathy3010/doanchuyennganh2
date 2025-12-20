#!/usr/bin/env node

/**
 * Test API Connection Script
 * Tests connection to backend from different environments
 */

const http = require('http');

const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 8001;

function testConnection(host, port) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            host,
            port,
            status: 'SUCCESS',
            httpStatus: res.statusCode,
            response
          });
        } catch (e) {
          resolve({
            host,
            port,
            status: 'PARSE_ERROR',
            httpStatus: res.statusCode,
            rawResponse: data
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        host,
        port,
        status: 'ERROR',
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        host,
        port,
        status: 'TIMEOUT'
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing API Connections...\n');

  // Test localhost (for web development)
  console.log('📡 Testing localhost:8001 (Web Development)');
  const localhostResult = await testConnection('localhost', 8001);
  console.log(`   Status: ${localhostResult.status}`);
  if (localhostResult.httpStatus) {
    console.log(`   HTTP: ${localhostResult.httpStatus}`);
  }
  if (localhostResult.response) {
    console.log(`   Services: ${JSON.stringify(localhostResult.response.services, null, 2)}`);
  }
  if (localhostResult.error) {
    console.log(`   Error: ${localhostResult.error}`);
  }
  console.log('');

  // Test 10.0.2.2 (Android emulator)
  console.log('🤖 Testing 10.0.2.2:8001 (Android Emulator)');
  const androidResult = await testConnection('10.0.2.2', 8001);
  console.log(`   Status: ${androidResult.status}`);
  if (androidResult.httpStatus) {
    console.log(`   HTTP: ${androidResult.httpStatus}`);
  }
  if (androidResult.error) {
    console.log(`   Error: ${androidResult.error}`);
  }
  console.log('');

  // Summary
  console.log('📋 Connection Summary:');
  console.log(`   localhost:8001 - ${localhostResult.status === 'SUCCESS' ? '✅' : '❌'}`);
  console.log(`   10.0.2.2:8001 - ${androidResult.status === 'SUCCESS' ? '✅' : '❌'}`);

  console.log('\n💡 Recommendations:');
  if (localhostResult.status !== 'SUCCESS') {
    console.log('   - Start backend server: cd backend && uvicorn main:app --host 0.0.0.0 --port 8001');
  }
  if (androidResult.status !== 'SUCCESS') {
    console.log('   - For Android emulator: Use 10.0.2.2 when backend is running');
    console.log('   - For physical devices: Replace 10.0.2.2 with your machine\'s IP');
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}
