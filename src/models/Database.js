const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, '../../config/images.db'));
    this.init();
  }

  init() {
    const createImagesTableQuery = `
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        category TEXT NOT NULL,
        orientation TEXT NOT NULL,
        url TEXT,
        is_local INTEGER DEFAULT 1,
        thumbnail TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'admin',
        is_active INTEGER DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createAccessControlTableQuery = `
      CREATE TABLE IF NOT EXISTS access_control (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- 'ip' or 'domain'
        value TEXT NOT NULL,
        action TEXT NOT NULL, -- 'allow' or 'deny'
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createSessionsTableQuery = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        data TEXT,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `;
    
    this.db.serialize(() => {
      this.db.run(createImagesTableQuery);
      this.db.run(createUsersTableQuery);
      this.db.run(createAccessControlTableQuery);
      this.db.run(createSessionsTableQuery);
    
    // 检查并添加thumbnail字段（兼容旧数据库）
    this.db.all("PRAGMA table_info(images)", (err, columns) => {
      if (!err && columns) {
        const hasThumbnailColumn = columns.some(col => col.name === 'thumbnail');
        if (!hasThumbnailColumn) {
          this.db.run("ALTER TABLE images ADD COLUMN thumbnail TEXT", (alterErr) => {
            if (alterErr) {
              console.error('Error adding thumbnail column:', alterErr);
            } else {
              console.log('Thumbnail column added to images table');
            }
          });
        }
      }
    });
      
      // 检查是否已有默认管理员账户
      this.db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
        if (!err && row.count === 0) {
          // 创建默认管理员账户
          const defaultPassword = await bcrypt.hash('admin123', 10);
          this.db.run(
            "INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)",
            ['admin', defaultPassword, 'admin@example.com', 'admin'],
            function(err) {
              if (err) {
                console.error('Error creating default admin user:', err);
              } else {
                console.log('Default admin user created: admin/admin123');
              }
            }
          );
        }
      });
      
      console.log('Database initialized successfully');
    });
    
    // 创建性能优化索引
    this.createIndexes();
  }

  // 创建数据库索引以优化查询性能
  createIndexes() {
    const indexes = [
      // 图片表索引
      "CREATE INDEX IF NOT EXISTS idx_images_category ON images(category)",
      "CREATE INDEX IF NOT EXISTS idx_images_orientation ON images(orientation)", 
      "CREATE INDEX IF NOT EXISTS idx_images_category_orientation ON images(category, orientation)",
      "CREATE INDEX IF NOT EXISTS idx_images_is_local ON images(is_local)",
      "CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at)",
      
      // 用户表索引
      "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
      "CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)",
      
      // 访问控制表索引
      "CREATE INDEX IF NOT EXISTS idx_access_control_type ON access_control(type)",
      "CREATE INDEX IF NOT EXISTS idx_access_control_action ON access_control(action)",
      "CREATE INDEX IF NOT EXISTS idx_access_control_is_active ON access_control(is_active)",
      
      // 会话表索引
      "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)"
    ];
    
    indexes.forEach(indexSql => {
      this.db.run(indexSql, (err) => {
        if (err) {
          console.error('Error creating index:', err);
        }
      });
    });
    
    console.log('Database indexes created for performance optimization');
  }

  addImage(imageData) {
    return new Promise((resolve, reject) => {
      const { filename, original_name, category, orientation, url, is_local, thumbnail } = imageData;
      const query = `
        INSERT INTO images (filename, original_name, category, orientation, url, is_local, thumbnail)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [filename, original_name, category, orientation, url, is_local, thumbnail], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...imageData });
        }
      });
    });
  }

  getAllImages() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM images ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getImagesByCategory(category) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM images WHERE category = ?', [category], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getImagesByOrientation(orientation) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM images WHERE orientation = ?', [orientation], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getRandomImage(category = null, orientation = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM images';
      let params = [];
      
      if (category && orientation) {
        query += ' WHERE category = ? AND orientation = ?';
        params = [category, orientation];
      } else if (category) {
        query += ' WHERE category = ?';
        params = [category];
      } else if (orientation) {
        query += ' WHERE orientation = ?';
        params = [orientation];
      }
      
      query += ' ORDER BY RANDOM() LIMIT 1';
      
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  updateImage(id, imageData) {
    return new Promise((resolve, reject) => {
      const { filename, original_name, category, orientation, url, is_local } = imageData;
      const query = `
        UPDATE images 
        SET filename = ?, original_name = ?, category = ?, orientation = ?, url = ?, is_local = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      this.db.run(query, [filename, original_name, category, orientation, url, is_local, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  deleteImage(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM images WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  getImageById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM images WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  getImagesPaginated(page = 1, limit = 12, category = null, orientation = null) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let whereClause = '';
      let params = [];
      
      if (category && orientation) {
        whereClause = ' WHERE category = ? AND orientation = ?';
        params = [category, orientation];
      } else if (category) {
        whereClause = ' WHERE category = ?';
        params = [category];
      } else if (orientation) {
        whereClause = ' WHERE orientation = ?';
        params = [orientation];
      }
      
      const dataQuery = `SELECT * FROM images${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      const countQuery = `SELECT COUNT(*) as total FROM images${whereClause}`;
      
      this.db.get(countQuery, params, (err, countResult) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.db.all(dataQuery, [...params, limit, offset], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const total = countResult.total;
            const totalPages = Math.ceil(total / limit);
            
            resolve({
              data: rows,
              pagination: {
                page: page,
                limit: limit,
                total: total,
                totalPages: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
              }
            });
          }
        });
      });
    });
  }

  // User Management Methods
  async createUser(userData) {
    return new Promise(async (resolve, reject) => {
      try {
        const { username, password, email, role = 'admin' } = userData;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = `
          INSERT INTO users (username, password, email, role)
          VALUES (?, ?, ?, ?)
        `;
        
        this.db.run(query, [username, hashedPassword, email, role], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, username, email, role });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  getUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  getUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  getAllUsers() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT id, username, email, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  updateUser(id, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        const updates = [];
        const params = [];
        
        if (userData.password) {
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          updates.push('password = ?');
          params.push(hashedPassword);
        }
        
        if (userData.email !== undefined) {
          updates.push('email = ?');
          params.push(userData.email);
        }
        
        if (userData.role !== undefined) {
          updates.push('role = ?');
          params.push(userData.role);
        }
        
        if (userData.is_active !== undefined) {
          updates.push('is_active = ?');
          params.push(userData.is_active);
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);
        
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        
        this.db.run(query, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  deleteUser(id) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE users SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  updateLastLogin(userId) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Access Control Methods
  addAccessRule(ruleData) {
    return new Promise((resolve, reject) => {
      const { type, value, action, description } = ruleData;
      const query = `
        INSERT INTO access_control (type, value, action, description)
        VALUES (?, ?, ?, ?)
      `;
      
      this.db.run(query, [type, value, action, description], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...ruleData });
        }
      });
    });
  }

  getAllAccessRules() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM access_control WHERE is_active = 1 ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  updateAccessRule(id, ruleData) {
    return new Promise((resolve, reject) => {
      const { type, value, action, description, is_active } = ruleData;
      const query = `
        UPDATE access_control 
        SET type = ?, value = ?, action = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      this.db.run(query, [type, value, action, description, is_active, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  deleteAccessRule(id) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE access_control SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  checkAccess(ip, host) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM access_control 
        WHERE is_active = 1 AND (
          (type = 'ip' AND ? LIKE value) OR 
          (type = 'domain' AND ? LIKE value)
        ) 
        ORDER BY action DESC, created_at ASC
      `;
      
      this.db.all(query, [ip, host], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // 如果有deny规则匹配，则拒绝访问
          const denyRule = rows.find(rule => rule.action === 'deny');
          if (denyRule) {
            resolve({ allowed: false, rule: denyRule });
            return;
          }
          
          // 如果有allow规则匹配，则允许访问
          const allowRule = rows.find(rule => rule.action === 'allow');
          if (allowRule) {
            resolve({ allowed: true, rule: allowRule });
            return;
          }
          
          // 默认允许访问（如果没有配置任何规则）
          resolve({ allowed: true, rule: null });
        }
      });
    });
  }
}

module.exports = Database;