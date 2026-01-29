const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  console.log('🚀 Setting up Aiven MySQL database...');
  console.log(`📊 Using database: ${process.env.DB_NAME}`);
  console.log(`🌐 Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  
  try {
    // Connect with SSL but don't verify (Aiven requires SSL connection)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      },
      connectTimeout: 10000,
      charset: 'utf8mb4'
    });

    console.log('✅ Connected to Aiven MySQL successfully!');
    
    // 1. Create users table in defaultdb
    console.log('📝 Creating users table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(255) DEFAULT NULL,
        is_online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created users table');
    
    // 2. Create rooms table
    console.log('📝 Creating rooms table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created rooms table');
    
    // 3. Insert default rooms
    console.log('📝 Inserting default rooms...');
    await connection.execute(`
      INSERT IGNORE INTO rooms (name, description) VALUES 
      ('General', 'General discussion room'),
      ('Random', 'Random talk about anything'),
      ('Help', 'Get help and support'),
      ('Technology', 'Discuss latest tech trends'),
      ('Gaming', 'For gamers to connect')
    `);
    console.log('✅ Inserted default rooms');
    
    // 4. Create messages table
    console.log('📝 Creating messages table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
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
        INDEX idx_room_id (room_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created messages table');
    
    // 5. Create typing_indicators table
    console.log('📝 Creating typing_indicators table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS typing_indicators (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        room_id INT,
        is_typing BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_room_user (room_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created typing_indicators table');
    
    // 6. Create user_rooms table
    console.log('📝 Creating user_rooms table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        room_id INT,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_room (user_id, room_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created user_rooms table');
    
    // 7. Create admin user (password: admin123)
    console.log('👤 Creating admin user...');
    await connection.execute(`
      INSERT IGNORE INTO users (username, email, password_hash) VALUES 
      ('admin', 'admin@chat.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq1V1.4T9Q9J6Jt7Jc6Z/7JbPwzQaK')
    `);
    console.log('✅ Created admin user (password: admin123)');
    
    // Show all tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('\n📊 Database tables created:');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });
    
    // Show default rooms
    const [rooms] = await connection.execute('SELECT id, name FROM rooms ORDER BY id');
    console.log('\n🏠 Available chat rooms:');
    rooms.forEach(room => {
      console.log(`   ${room.id}. ${room.name}`);
    });
    
    // Show admin user - FIXED with parameterized query
    try {
      const [admin] = await connection.execute('SELECT id, username, email FROM users WHERE username = ?', ['admin']);
      if (admin && admin.length > 0) {
        console.log(`\n🔐 Admin user: ${admin[0].username} (${admin[0].email})`);
        console.log('   Password: admin123');
      } else {
        console.log('\n⚠️  Admin user created but could not be retrieved');
      }
    } catch (adminError) {
      console.log('\nℹ️  Admin user details not available yet');
    }
    
    // Test data insertion
    console.log('\n🧪 Testing data insertion...');
    try {
      const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
      const [roomCount] = await connection.execute('SELECT COUNT(*) as count FROM rooms');
      console.log(`   Users: ${userCount[0].count}`);
      console.log(`   Rooms: ${roomCount[0].count}`);
    } catch (testError) {
      console.log('   Test query failed:', testError.message);
    }
    
    await connection.end();
    console.log('\n🎉 Database setup completed successfully!');
    console.log('👉 Your tables are now in the defaultdb database');
    console.log('👉 Run: npm start to start the chat server');
    
  } catch (error) {
    console.error('\n❌ Database setup failed!');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Check your database credentials in .env file:');
      console.error('   DB_USER, DB_PASSWORD, DB_NAME');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Cannot resolve hostname. Check DB_HOST in .env');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n💡 Connection timeout. Check your network/firewall');
    }
  }
}

// Run setup
if (require.main === module) {
  setupDatabase();
} else {
  module.exports = setupDatabase;
}