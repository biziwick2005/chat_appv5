require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const fs = require('fs');

const db = require('./db');
const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const setupSocket = require('./socket/socket');

const app = express();
const server = http.createServer(app);

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

// Configure CORS for production
const corsOptions = {
  origin: isProduction 
    ? ['https://realtime-chat.onrender.com', 'http://localhost:3001']
    : 'http://localhost:3001',
  credentials: true
};

// Configure Socket.io
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store io instance for use in routes
app.set('io', io);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: isProduction ? '1d' : '0'
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Setup Socket.io
setupSocket(io);

// ======================
// PWA SUPPORT ENDPOINTS
// ======================

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await db.execute('SELECT 1');
    
    res.status(200).json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development',
      pwa: {
        supported: true,
        version: '1.0.0'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message,
      database: 'disconnected'
    });
  }
});

// PWA Version endpoint - CRITICAL for updates
app.get('/version.json', (req, res) => {
  res.json({
    version: '1.0.0',
    build_date: new Date().toISOString(),
    changelog: [
      'Initial PWA release',
      'Real-time chat with Socket.io',
      'File upload support',
      'Multiple chat rooms',
      'Online user indicators',
      'Mobile responsive design',
      'PWA installation support'
    ],
    update_required: false,
    update_message: '',
    update_url: '',
    pwa_features: {
      installable: true,
      offline_support: true,
      push_notifications: false,
      background_sync: true
    }
  });
});

// PWA Manifest endpoint (optional, but good to have)
app.get('/manifest.webmanifest', (req, res) => {
  res.json({
    name: 'RealTime Chat',
    short_name: 'ChatApp',
    description: 'Professional real-time chat application',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#667eea',
    theme_color: '#007AFF',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png'
      },
      {
        src: '/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png'
      },
      {
        src: '/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png'
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    shortcuts: [
      {
        name: 'New Chat',
        short_name: 'Chat',
        description: 'Start a new chat',
        url: '/'
      }
    ]
  });
});

// Service Worker endpoint (for debugging)
app.get('/sw.js', (req, res) => {
  const swPath = path.join(__dirname, '../public/sw.js');
  if (fs.existsSync(swPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(swPath);
  } else {
    res.status(404).json({ error: 'Service worker not found' });
  }
});

// PWA Status endpoint
app.get('/pwa-status', (req, res) => {
  res.json({
    pwa_supported: true,
    service_worker: fs.existsSync(path.join(__dirname, '../public/sw.js')),
    manifest: fs.existsSync(path.join(__dirname, '../public/manifest.json')),
    icons: {
      '192x192': fs.existsSync(path.join(__dirname, '../public/icon-192x192.png')),
      '512x512': fs.existsSync(path.join(__dirname, '../public/icon-512x512.png'))
    },
    environment: process.env.NODE_ENV || 'development',
    https: req.secure || req.headers['x-forwarded-proto'] === 'https'
  });
});

// Environment check endpoint
app.get('/env-check', (req, res) => {
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DB_HOST: process.env.DB_HOST ? 'Set' : 'Not Set',
    DB_NAME: process.env.DB_NAME,
    JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'NOT SET - ERROR!',
    FRONTEND_URL: process.env.FRONTEND_URL
  };
  
  res.json({
    status: process.env.JWT_SECRET ? 'healthy' : 'unhealthy',
    environment: envVars,
    timestamp: new Date().toISOString()
  });
});

// ======================
// API DOCUMENTATION
// ======================

// API Documentation
app.get('/api-docs', (req, res) => {
  res.json({
    name: 'RealTime Chat API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me'
      },
      chat: {
        rooms: 'GET /api/chat/rooms',
        messages: 'GET /api/chat/messages/:roomId',
        upload: 'POST /api/chat/upload',
        deleteMessage: 'DELETE /api/chat/message/:id',
        search: 'GET /api/chat/search'
      },
      pwa: {
        health: 'GET /health',
        version: 'GET /version.json',
        manifest: 'GET /manifest.json',
        pwaStatus: 'GET /pwa-status',
        envCheck: 'GET /env-check'
      }
    },
    pwa_features: {
      installable: true,
      offline_support: true,
      auto_updates: true,
      version: '1.0.0'
    }
  });
});

// ======================
// ERROR HANDLING
// ======================

// Serve frontend for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      success: false, 
      message: 'API endpoint not found' 
    });
  }
  
  // For PWA, always serve index.html
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      success: false,
      message: 'File size too large. Maximum is 10MB.' 
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(!isProduction && { stack: err.stack })
  });
});

// ======================
// START SERVER
// ======================

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 RealTime Chat Server
  -------------------------
  📍 Port: ${PORT}
  🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
  📁 Uploads: ${uploadsDir}
  🗄️  Database: ${process.env.DB_HOST || 'localhost'}
  -------------------------
  `);
  
  // Log available routes
  console.log('📡 Available Routes:');
  console.log('  GET  /health          - Health check');
  console.log('  GET  /version.json    - PWA version info');
  console.log('  GET  /pwa-status      - PWA status check');
  console.log('  GET  /env-check       - Environment check');
  console.log('  GET  /api-docs        - API documentation');
  console.log('  POST /api/auth/register - Register user');
  console.log('  POST /api/auth/login    - Login user');
  console.log('  GET  /api/chat/rooms    - Get chat rooms');
  console.log('  GET  /api/chat/messages/:roomId - Get messages');
  console.log('  DELETE /api/chat/message/:id - Delete message');
  
  console.log('\n🎯 PWA Status:');
  console.log(`  ✅ Service Worker: ${fs.existsSync(path.join(__dirname, '../public/sw.js')) ? 'Ready' : 'Missing!'}`);
  console.log(`  ✅ Manifest: ${fs.existsSync(path.join(__dirname, '../public/manifest.json')) ? 'Ready' : 'Missing!'}`);
  console.log(`  ✅ Version: 1.0.0`);
  
  // Check for required environment variables
  console.log('\n🔧 Environment Check:');
  console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ NOT SET!'}`);
  console.log(`  DB_HOST: ${process.env.DB_HOST ? '✅ Set' : '⚠️  Not set'}`);
  console.log(`  FRONTEND_URL: ${process.env.FRONTEND_URL || '⚠️  Not set'}`);
  
  console.log('\n💡 PWA Installation:');
  console.log('  Visit the site a few times to see install button');
  console.log('  Test PWA: https://chat-appv5.onrender.com/pwa-status');
  console.log('  Check version: https://chat-appv5.onrender.com/version.json');
});