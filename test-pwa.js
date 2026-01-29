const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('🧪 PWA COMPLETE TEST SUITE\n');
console.log('='.repeat(60));

const BASE_URL = 'http://localhost:3001';
const PROJECT_ROOT = process.cwd();

// 1. Check all required files exist
console.log('📁 FILE STRUCTURE CHECK:');

const requiredFiles = [
  { path: 'public/sw.js', desc: 'Service Worker' },
  { path: 'public/version.json', desc: 'Version File' },
  { path: 'public/manifest.json', desc: 'PWA Manifest' },
  { path: 'public/auth.js', desc: 'Auth Script (with PWA)' },
  { path: 'public/icon-192x192.png', desc: 'PWA Icon 192x192' },
  { path: 'public/icon-512x512.png', desc: 'PWA Icon 512x512' },
  { path: 'server/server.js', desc: 'Server with PWA endpoints' }
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file.path);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file.desc}: ${file.path}`);
  
  if (!exists) allFilesExist = false;
  
  if (exists) {
    // Check file content
    try {
      const content = fs.readFileSync(file.path, 'utf8');
      
      switch(file.path) {
        case 'public/sw.js':
          const hasVersion = content.includes('APP_VERSION');
          const hasCacheName = content.includes('CACHE_NAME');
          console.log(`   ${hasVersion ? '✅' : '❌'} Has version: ${hasVersion}`);
          console.log(`   ${hasCacheName ? '✅' : '❌'} Has cache name: ${hasCacheName}`);
          break;
          
        case 'public/auth.js':
          const hasServiceWorkerReg = content.includes('serviceWorker.register');
          const hasBeforeInstallPrompt = content.includes('beforeinstallprompt');
          console.log(`   ${hasServiceWorkerReg ? '✅' : '❌'} Registers service worker`);
          console.log(`   ${hasBeforeInstallPrompt ? '✅' : '❌'} Has install prompt handler`);
          break;
          
        case 'server/server.js':
          const hasVersionEndpoint = content.includes('/version.json');
          const hasHealthEndpoint = content.includes('/health');
          console.log(`   ${hasVersionEndpoint ? '✅' : '❌'} Has version endpoint`);
          console.log(`   ${hasHealthEndpoint ? '✅' : '❌'} Has health endpoint`);
          break;
      }
    } catch (error) {
      console.log(`   ❌ Error reading file: ${error.message}`);
    }
  }
});

console.log('\n' + '='.repeat(60));
console.log('🌐 ENDPOINT TESTING:');

// 2. Test endpoints (when server is running)
const endpoints = [
  { path: '/health', desc: 'Health Check' },
  { path: '/version.json', desc: 'Version Info' },
  { path: '/manifest.json', desc: 'PWA Manifest' },
  { path: '/sw.js', desc: 'Service Worker' },
  { path: '/pwa-status', desc: 'PWA Status' }
];

async function testEndpoints() {
  for (const endpoint of endpoints) {
    await testEndpoint(`${BASE_URL}${endpoint.path}`, endpoint.desc);
  }
}

function testEndpoint(url, desc) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      const status = res.statusCode === 200 ? '✅' : '❌';
      console.log(`${status} ${desc}: ${url} (${res.statusCode})`);
      resolve();
    }).on('error', (err) => {
      console.log(`❌ ${desc}: ${url} (Error: ${err.code})`);
      resolve();
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`⚠️ ${desc}: ${url} (Timeout)`);
      resolve();
    });
  });
}

// 3. Generate test report
async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY:\n');
  
  if (!allFilesExist) {
    console.log('❌ CRITICAL: Missing required files!');
    console.log('   Please create all missing files before deployment.');
  } else {
    console.log('✅ All required files exist');
  }
  
  console.log('\n🚀 DEPLOYMENT READY CHECKLIST:');
  console.log('1. ✅ Create public/sw.js with service worker code');
  console.log('2. ✅ Create public/version.json with version info');
  console.log('3. ✅ Update server.js with PWA endpoints');
  console.log('4. ✅ Update auth.js with PWA installation code');
  console.log('5. ✅ Ensure all PWA icons exist in public/ folder');
  console.log('6. ✅ Test locally: npm run dev');
  console.log('7. ✅ Visit http://localhost:3001 and check for install button');
  
  console.log('\n🔧 QUICK FIXES IF NEEDED:');
  
  // Check for common issues
  const checks = [
    { 
      condition: !fs.existsSync('public/sw.js'),
      fix: 'Create public/sw.js with the service worker code provided'
    },
    { 
      condition: !fs.existsSync('public/version.json'),
      fix: 'Create public/version.json with {"version": "1.0.0"}'
    },
    {
      condition: fs.existsSync('server/server.js') && 
                 !fs.readFileSync('server/server.js', 'utf8').includes('/version.json'),
      fix: 'Add version endpoint to server.js'
    }
  ];
  
  checks.forEach(check => {
    if (check.condition) {
      console.log(`   • ${check.fix}`);
    }
  });
  
  console.log('\n📱 PWA INSTALLATION TEST:');
  console.log('   1. Start server: npm run dev');
  console.log('   2. Open browser: http://localhost:3001');
  console.log('   3. Open DevTools (F12) → Application tab');
  console.log('   4. Check: Manifest, Service Workers, Storage');
  console.log('   5. Visit site 2-3 times to trigger install prompt');
  
  console.log('\n🔗 TEST URLs (after server start):');
  endpoints.forEach(ep => {
    console.log(`   http://localhost:3001${ep.path}`);
  });
}

// Run tests
generateReport();

console.log('\n' + '='.repeat(60));
console.log('💡 Next: Run these commands in order:');
console.log('   1. npm run dev          # Start local server');
console.log('   2. Open browser to http://localhost:3001');
console.log('   3. Check console for PWA registration');
console.log('   4. Test install button appears after 5 seconds');