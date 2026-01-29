const router = require('express').Router();
const path = require('path');
const fs = require('fs').promises;
const db = require('../db');
const { verifyToken } = require('../middleware/auth.middleware');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mp3/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Error: File type not allowed!'));
  }
});

// Get all rooms
router.get('/rooms', verifyToken, async (req, res) => {
  try {
    const [rooms] = await db.execute('SELECT * FROM rooms ORDER BY name');
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Error fetching rooms' });
  }
});

// Get messages for a room - SIMPLE FIXED VERSION
router.get('/messages/:roomId', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Convert roomId to integer
    const roomIdInt = parseInt(roomId);
    
    // Check if room exists
    const [roomAccess] = await db.execute(
      'SELECT id FROM rooms WHERE id = ?',
      [roomIdInt]
    );

    if (roomAccess.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Get messages with user info - NO PAGINATION, NO LIMIT/OFFSET
    const [messages] = await db.execute(
      `SELECT m.*, u.username, u.avatar_url,
       CASE WHEN m.user_id = ? THEN 1 ELSE 0 END as is_own
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.room_id = ? AND m.is_deleted = FALSE
       ORDER BY m.created_at ASC`,
      [req.user.id, roomIdInt]
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Alternative: Get messages with string concatenation for LIMIT (if you need pagination)
router.get('/messages2/:roomId', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    // Convert to integers
    const roomIdInt = parseInt(roomId);
    const limitInt = parseInt(limit);
    const offsetInt = parseInt(offset);

    // Use string concatenation for LIMIT/OFFSET
    const [messages] = await db.query(
      `SELECT m.*, u.username, u.avatar_url,
       CASE WHEN m.user_id = ? THEN 1 ELSE 0 END as is_own
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.room_id = ? AND m.is_deleted = FALSE
       ORDER BY m.created_at DESC
       LIMIT ${limitInt} OFFSET ${offsetInt}`,
      [req.user.id, roomIdInt]
    );

    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Search messages
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { query, roomId } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const searchQuery = `%${query}%`;
    
    let sql = '';
    let params = [];
    
    if (roomId) {
      sql = `SELECT m.*, u.username, u.avatar_url, r.name as room_name
             FROM messages m
             JOIN users u ON m.user_id = u.id
             JOIN rooms r ON m.room_id = r.id
             WHERE m.content LIKE ? AND m.is_deleted = FALSE AND m.room_id = ?
             ORDER BY m.created_at DESC
             LIMIT 100`;
      params = [searchQuery, parseInt(roomId)];
    } else {
      sql = `SELECT m.*, u.username, u.avatar_url, r.name as room_name
             FROM messages m
             JOIN users u ON m.user_id = u.id
             JOIN rooms r ON m.room_id = r.id
             WHERE m.content LIKE ? AND m.is_deleted = FALSE
             ORDER BY m.created_at DESC
             LIMIT 100`;
      params = [searchQuery];
    }

    const [messages] = await db.execute(sql, params);
    res.json(messages);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
});

// Upload file
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'File upload failed' });
  }
});

// Delete message
router.delete('/message/:id', verifyToken, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);

    // Check if message exists and belongs to user
    const [messages] = await db.execute(
      'SELECT id, user_id FROM messages WHERE id = ?',
      [messageId]
    );

    if (messages.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (messages[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    // Soft delete the message
    await db.execute(
      'UPDATE messages SET is_deleted = TRUE, content = "This message was deleted" WHERE id = ?',
      [messageId]
    );

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Failed to delete message' });
  }
});

// Get online users in a room
router.get('/room/:roomId/online-users', verifyToken, async (req, res) => {
  try {
    const [users] = await db.execute(
      `SELECT DISTINCT u.id, u.username, u.avatar_url 
       FROM users u
       JOIN typing_indicators t ON u.id = t.user_id
       WHERE t.room_id = ? AND u.is_online = TRUE
       ORDER BY u.username`,
      [parseInt(req.params.roomId)]
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ message: 'Error fetching online users' });
  }
});

module.exports = router;