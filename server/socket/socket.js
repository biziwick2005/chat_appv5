const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = (io) => {
  io.on('connection', async (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    try {
      // Verify token
      const token = socket.handshake.auth.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;

      // Update user online status
      await db.execute('UPDATE users SET is_online = TRUE WHERE id = ?', [socket.user.id]);

      // Join user to their personal room for private messages
      socket.join(`user_${socket.user.id}`);

      // Get user's rooms and join them
      const [userRooms] = await db.execute(
        'SELECT r.id FROM rooms r LEFT JOIN user_rooms ur ON r.id = ur.room_id WHERE ur.user_id = ? OR ur.user_id IS NULL',
        [socket.user.id]
      );

      userRooms.forEach(room => {
        socket.join(`room_${room.id}`);
      });

      // Notify others that user is online
      socket.broadcast.emit('userOnline', {
        id: socket.user.id,
        username: socket.user.username
      });

      // Handle joining a room
      socket.on('joinRoom', async (roomId) => {
        socket.join(`room_${roomId}`);
        
        // Add user to room if not already added
        try {
          await db.execute(
            'INSERT IGNORE INTO user_rooms (user_id, room_id) VALUES (?, ?)',
            [socket.user.id, roomId]
          );
        } catch (error) {
          console.error('Error adding user to room:', error);
        }
        
        // Get online users in this room
        const [onlineUsers] = await db.execute(
          `SELECT DISTINCT u.id, u.username, u.avatar_url 
           FROM users u
           JOIN typing_indicators t ON u.id = t.user_id
           WHERE t.room_id = ? AND u.is_online = TRUE`,
          [roomId]
        );
        
        socket.emit('roomOnlineUsers', onlineUsers);
      });

      // Handle typing indicator
      socket.on('typing', async ({ roomId, isTyping }) => {
        try {
          if (isTyping) {
            await db.execute(
              'INSERT INTO typing_indicators (user_id, room_id, is_typing) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_typing = ?',
              [socket.user.id, roomId, true, true]
            );
          } else {
            await db.execute(
              'UPDATE typing_indicators SET is_typing = FALSE WHERE user_id = ? AND room_id = ?',
              [socket.user.id, roomId]
            );
          }

          socket.to(`room_${roomId}`).emit('userTyping', {
            userId: socket.user.id,
            username: socket.user.username,
            isTyping
          });
        } catch (error) {
          console.error('Error updating typing indicator:', error);
        }
      });

      // Handle sending messages
      socket.on('sendMessage', async (data) => {
        try {
          const { roomId, content, messageType = 'text', fileUrl = null, fileName = null, fileSize = null } = data;
          
          // Insert message into database
          const [result] = await db.execute(
            `INSERT INTO messages (room_id, user_id, content, message_type, file_url, file_name, file_size) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [roomId, socket.user.id, content, messageType, fileUrl, fileName, fileSize]
          );

          // Get the complete message with user info
          const [messages] = await db.execute(
            `SELECT m.*, u.username, u.avatar_url 
             FROM messages m 
             JOIN users u ON m.user_id = u.id 
             WHERE m.id = ?`,
            [result.insertId]
          );

          if (messages.length > 0) {
            const message = {
              ...messages[0],
              is_own: false // This will be set to true on the sender's side
            };

            // Broadcast to room
            io.to(`room_${roomId}`).emit('newMessage', message);
          }
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('messageError', { error: 'Failed to send message' });
        }
      });

      // Handle message deletion
      socket.on('deleteMessage', async ({ messageId, roomId }) => {
        try {
          const [result] = await db.execute(
            'UPDATE messages SET is_deleted = TRUE WHERE id = ? AND user_id = ?',
            [messageId, socket.user.id]
          );

          if (result.affectedRows > 0) {
            io.to(`room_${roomId}`).emit('messageDeleted', { messageId });
          }
        } catch (error) {
          console.error('Error deleting message:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        try {
          // Update user offline status
          await db.execute('UPDATE users SET is_online = FALSE WHERE id = ?', [socket.user.id]);
          
          // Clear typing indicators
          await db.execute('DELETE FROM typing_indicators WHERE user_id = ?', [socket.user.id]);

          // Notify others that user is offline
          socket.broadcast.emit('userOffline', {
            id: socket.user.id,
            username: socket.user.username
          });
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
        
        console.log(`Disconnected: ${socket.id}`);
      });

    } catch (error) {
      console.error('Socket connection error:', error);
      socket.disconnect();
    }
  });
};