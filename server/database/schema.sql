CREATE DATABASE IF NOT EXISTS chat_app;
USE chat_app;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255) DEFAULT NULL,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT,
  user_id INT,
  content TEXT,
  message_type ENUM('text', 'image', 'file', 'emoji') DEFAULT 'text',
  file_url VARCHAR(255) DEFAULT NULL,
  file_name VARCHAR(255) DEFAULT NULL,
  file_size INT DEFAULT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_room_created (room_id, created_at),
  FULLTEXT idx_content (content)
);

CREATE TABLE typing_indicators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  room_id INT,
  is_typing BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room_user (room_id, user_id)
);

CREATE TABLE user_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  room_id INT,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_room (user_id, room_id)
);

-- Insert default rooms
INSERT INTO rooms (name, description) VALUES 
('General', 'General discussion room'),
('Random', 'Random talk about anything'),
('Help', 'Get help and support'),
('Technology', 'Discuss latest tech trends'),
('Gaming', 'For gamers to connect');

-- Create admin user (password: admin123)
INSERT INTO users (username, email, password_hash) VALUES 
('admin', 'admin@chat.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq1V1.4T9Q9J6Jt7Jc6Z/7JbPwzQaK'); -- bcrypt hash for 'admin123'