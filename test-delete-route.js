const fs = require('fs');
const path = require('path');

console.log('🔍 Checking delete route implementation...\n');

// Check server/routes/chat.routes.js
const chatRoutesPath = path.join(__dirname, 'server', 'routes', 'chat.routes.js');

if (fs.existsSync(chatRoutesPath)) {
  console.log('✅ Found chat.routes.js');
  
  const content = fs.readFileSync(chatRoutesPath, 'utf8');
  
  // Check for DELETE route
  if (content.includes('router.delete')) {
    console.log('✅ DELETE route found in chat.routes.js');
    
    // Extract delete route
    const deleteMatch = content.match(/router\.delete\([^)]+\)[^{]+\{[\s\S]*?\n\}/);
    if (deleteMatch) {
      console.log('\n📝 Delete route code:');
      console.log(deleteMatch[0].substring(0, 500) + '...');
    }
  } else {
    console.log('❌ No DELETE route found in chat.routes.js');
  }
  
  // Check for auth middleware
  if (content.includes('verifyToken') || content.includes('authMiddleware')) {
    console.log('✅ Authentication middleware found');
  } else {
    console.log('⚠️ No authentication middleware found on delete route');
  }
  
} else {
  console.log('❌ chat.routes.js not found at:', chatRoutesPath);
}

// Check server/server.js for routes
console.log('\n📋 Checking server.js for routes...');
const serverPath = path.join(__dirname, 'server', 'server.js');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  if (serverContent.includes('/api/chat')) {
    console.log('✅ /api/chat route is mounted');
  }
  
  // Check if chat routes are imported
  if (serverContent.includes('chatRoutes')) {
    console.log('✅ chatRoutes are imported');
  }
}

console.log('\n🧪 To test delete functionality:');
console.log('1. Make sure you have a message ID from your chat');
console.log('2. Open browser DevTools (F12)');
console.log('3. Go to Console tab');
console.log('4. Run this code:');
console.log(`
   async function testDelete(id) {
     const token = localStorage.getItem('token');
     const response = await fetch('/api/chat/message/' + id, {
       method: 'DELETE',
       headers: {
         'Authorization': 'Bearer ' + token,
         'Content-Type': 'application/json'
       }
     });
     console.log('Status:', response.status);
     const result = await response.json();
     console.log('Result:', result);
     return result;
   }
   
   // Then call with a message ID:
   // testDelete('123');
`);