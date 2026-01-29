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
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message,
      database: 'disconnected'
    });
  }
});

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
      }
    }
  });
});

// Serve frontend for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('🚨 Error:', err.stack);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      message: 'File size too large. Maximum is 10MB.' 
    });
  }
  
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(!isProduction && { stack: err.stack })
  });
});

// Start server
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
  console.log('📡 Available routes:');
  console.log('  GET  /health          - Health check');
  console.log('  POST /api/auth/register - Register user');
  console.log('  POST /api/auth/login    - Login user');
  console.log('  GET  /api/chat/rooms    - Get chat rooms');
  console.log('  GET  /api/chat/messages/:roomId - Get messages');
});