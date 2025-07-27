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
        email TEXT UNIQUE,
        role TEXT DEFAULT 'user',
        permissions TEXT DEFAULT '["view_images", "upload_images"]',
        is_active INTEGER DEFAULT 1,
        email_verified INTEGER DEFAULT 0,
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
    
    const createPasswordResetsTableQuery = `
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    const createEmailVerificationTableQuery = `
      CREATE TABLE IF NOT EXISTS email_verification (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    const createUserProfileTableQuery = `
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        preferences TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;
    
    const createApiStatsTableQuery = `
      CREATE TABLE IF NOT EXISTS api_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        referer TEXT,
        response_status INTEGER,
        response_time INTEGER, -- in milliseconds
        image_id INTEGER,
        category TEXT,
        orientation TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images (id)
      )
    `;
    
    const createDailyStatsTableQuery = `
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL, -- YYYY-MM-DD format
        total_requests INTEGER DEFAULT 0,
        unique_ips INTEGER DEFAULT 0,
        successful_requests INTEGER DEFAULT 0,
        failed_requests INTEGER DEFAULT 0,
        avg_response_time REAL DEFAULT 0,
        popular_category TEXT,
        popular_orientation TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createSystemConfigTableQuery = `
      CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        description TEXT,
        updated_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users (id)
      )
    `;
    
    this.db.serialize(() => {
      this.db.run(createImagesTableQuery);
      this.db.run(createUsersTableQuery);
      this.db.run(createAccessControlTableQuery);
      this.db.run(createSessionsTableQuery);
      this.db.run(createPasswordResetsTableQuery);
      this.db.run(createEmailVerificationTableQuery);
      this.db.run(createUserProfileTableQuery);
      this.db.run(createApiStatsTableQuery);
      this.db.run(createDailyStatsTableQuery);
      this.db.run(createSystemConfigTableQuery);
    
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

    // 检查并添加用户表的新字段（兼容旧数据库）
    this.db.all("PRAGMA table_info(users)", (err, columns) => {
      if (!err && columns) {
        const columnNames = columns.map(col => col.name);
        
        // 检查并添加缺失的列
        const requiredColumns = [
          { name: 'permissions', type: 'TEXT', default: '\'["view_images", "upload_images"]\'' },
          { name: 'is_active', type: 'INTEGER', default: '1' },
          { name: 'email_verified', type: 'INTEGER', default: '0' },
          { name: 'last_login', type: 'DATETIME', default: 'NULL' },
          { name: 'updated_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
        ];

        requiredColumns.forEach(column => {
          if (!columnNames.includes(column.name)) {
            const sql = `ALTER TABLE users ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default}`;
            this.db.run(sql, (alterErr) => {
              if (alterErr) {
                console.error(`Error adding ${column.name} column:`, alterErr);
              } else {
                console.log(`${column.name} column added to users table`);
              }
            });
          }
        });
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
      
      // 初始化默认系统配置
      this.initDefaultSystemConfig();
      
      console.log('Database initialized successfully');
    });
    
    // 创建性能优化索引
    this.createIndexes();
  }

  // 初始化默认系统配置
  async initDefaultSystemConfig() {
    const defaultConfigs = [
      {
        key: 'registration_enabled',
        value: 'true',
        description: '是否允许用户注册'
      },
      {
        key: 'registration_require_approval',
        value: 'false',
        description: '注册后是否需要管理员审核'
      },
      {
        key: 'max_users',
        value: '1000',
        description: '最大用户数量限制'
      },
      {
        key: 'registration_message',
        value: '欢迎注册 Random Image API！',
        description: '注册页面显示消息'
      },
      {
        key: 'site_maintenance',
        value: 'false',
        description: '网站维护模式'
      }
    ];

    try {
      for (const config of defaultConfigs) {
        // 检查配置是否已存在
        const existing = await this.getSystemConfig(config.key);
        if (!existing) {
          await this.setSystemConfig(config.key, config.value, config.description);
          console.log(`📋 Initialized system config: ${config.key} = ${config.value}`);
        }
      }
    } catch (error) {
      console.error('Error initializing default system config:', error);
    }
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
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
      "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
      "CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)",
      "CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified)",
      
      // 访问控制表索引
      "CREATE INDEX IF NOT EXISTS idx_access_control_type ON access_control(type)",
      "CREATE INDEX IF NOT EXISTS idx_access_control_action ON access_control(action)",
      "CREATE INDEX IF NOT EXISTS idx_access_control_is_active ON access_control(is_active)",
      
      // 会话表索引
      "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)",
      
      // API统计表索引
      "CREATE INDEX IF NOT EXISTS idx_api_stats_endpoint ON api_stats(endpoint)",
      "CREATE INDEX IF NOT EXISTS idx_api_stats_ip_address ON api_stats(ip_address)",
      "CREATE INDEX IF NOT EXISTS idx_api_stats_created_at ON api_stats(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_api_stats_response_status ON api_stats(response_status)",
      "CREATE INDEX IF NOT EXISTS idx_api_stats_category ON api_stats(category)",
      "CREATE INDEX IF NOT EXISTS idx_api_stats_orientation ON api_stats(orientation)",
      
      // 日统计表索引
      "CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)",
      
      // 系统配置表索引
      "CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key)",
      "CREATE INDEX IF NOT EXISTS idx_system_config_updated_by ON system_config(updated_by)",
      
      // 邮箱验证表索引
      "CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification(token)",
      "CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at ON email_verification(expires_at)",
      
      // 密码重置表索引  
      "CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token)",
      "CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at)",
      
      // 用户配置表索引
      "CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id)"
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

  // 系统配置管理方法
  getSystemConfig(key) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM system_config WHERE config_key = ?';
      this.db.get(query, [key], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  getAllSystemConfigs() {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM system_config ORDER BY config_key ASC';
      this.db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  setSystemConfig(key, value, description = null, updatedBy = null) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO system_config 
        (config_key, config_value, description, updated_by, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(query, [key, value, description, updatedBy], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            config_key: key,
            config_value: value,
            description,
            updated_by: updatedBy
          });
        }
      });
    });
  }

  deleteSystemConfig(key) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM system_config WHERE config_key = ?';
      this.db.run(query, [key], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // 便捷方法：检查注册是否启用
  async isRegistrationEnabled() {
    try {
      const config = await this.getSystemConfig('registration_enabled');
      return config ? config.config_value === 'true' : true; // 默认启用
    } catch (error) {
      console.error('Error checking registration status:', error);
      return true; // 发生错误时默认允许注册
    }
  }

  // 便捷方法：检查是否需要审核
  async isRegistrationApprovalRequired() {
    try {
      const config = await this.getSystemConfig('registration_require_approval');
      return config ? config.config_value === 'true' : false; // 默认不需要审核
    } catch (error) {
      console.error('Error checking approval requirement:', error);
      return false;
    }
  }

  // 便捷方法：获取最大用户数限制
  async getMaxUsersLimit() {
    try {
      const config = await this.getSystemConfig('max_users');
      return config ? parseInt(config.config_value) : 1000; // 默认1000
    } catch (error) {
      console.error('Error getting max users limit:', error);
      return 1000;
    }
  }

  // 便捷方法：检查网站是否在维护模式
  async isMaintenanceMode() {
    try {
      const config = await this.getSystemConfig('site_maintenance');
      return config ? config.config_value === 'true' : false; // 默认不维护
    } catch (error) {
      console.error('Error checking maintenance mode:', error);
      return false;
    }
  }

  // Analytics and Statistics Methods
  recordApiRequest(requestData) {
    return new Promise((resolve, reject) => {
      const { 
        endpoint, method, ip_address, user_agent, referer, 
        response_status, response_time, image_id, category, orientation 
      } = requestData;
      
      const query = `
        INSERT INTO api_stats 
        (endpoint, method, ip_address, user_agent, referer, response_status, response_time, image_id, category, orientation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        endpoint, method, ip_address, user_agent, referer, 
        response_status, response_time, image_id, category, orientation
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  updateDailyStats(date = null) {
    return new Promise((resolve, reject) => {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      // 获取当日统计数据
      const statsQuery = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(DISTINCT ip_address) as unique_ips,
          SUM(CASE WHEN response_status = 200 THEN 1 ELSE 0 END) as successful_requests,
          SUM(CASE WHEN response_status != 200 THEN 1 ELSE 0 END) as failed_requests,
          AVG(response_time) as avg_response_time
        FROM api_stats 
        WHERE DATE(created_at) = ?
      `;
      
      this.db.get(statsQuery, [targetDate], (err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 获取最受欢迎的分类和方向
        const popularQuery = `
          SELECT 
            category,
            orientation,
            COUNT(*) as count
          FROM api_stats 
          WHERE DATE(created_at) = ? AND category IS NOT NULL
          GROUP BY category, orientation 
          ORDER BY count DESC 
          LIMIT 1
        `;
        
        this.db.get(popularQuery, [targetDate], (err, popular) => {
          if (err) {
            reject(err);
            return;
          }
          
          // 更新或插入日统计
          const upsertQuery = `
            INSERT OR REPLACE INTO daily_stats 
            (date, total_requests, unique_ips, successful_requests, failed_requests, avg_response_time, popular_category, popular_orientation, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `;
          
          this.db.run(upsertQuery, [
            targetDate,
            stats.total_requests || 0,
            stats.unique_ips || 0,
            stats.successful_requests || 0,
            stats.failed_requests || 0,
            stats.avg_response_time || 0,
            popular ? popular.category : null,
            popular ? popular.orientation : null
          ], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ date: targetDate, ...stats, popular });
            }
          });
        });
      });
    });
  }

  getApiStats(days = 7) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM daily_stats 
        WHERE date >= date('now', '-${days} days')
        ORDER BY date DESC
      `;
      
      this.db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getDetailedStats(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const queries = {
        // 总体统计
        overview: `
          SELECT 
            COUNT(*) as total_requests,
            COUNT(DISTINCT ip_address) as unique_visitors,
            SUM(CASE WHEN response_status = 200 THEN 1 ELSE 0 END) as successful_requests,
            SUM(CASE WHEN response_status != 200 THEN 1 ELSE 0 END) as failed_requests,
            AVG(response_time) as avg_response_time,
            MIN(created_at) as first_request,
            MAX(created_at) as last_request
          FROM api_stats 
          WHERE DATE(created_at) BETWEEN ? AND ?
        `,
        
        // 每日趋势
        daily_trend: `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as requests,
            COUNT(DISTINCT ip_address) as unique_ips,
            AVG(response_time) as avg_response_time
          FROM api_stats 
          WHERE DATE(created_at) BETWEEN ? AND ?
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `,
        
        // 热门分类
        popular_categories: `
          SELECT 
            category,
            COUNT(*) as count,
            COUNT(DISTINCT ip_address) as unique_users
          FROM api_stats 
          WHERE DATE(created_at) BETWEEN ? AND ? AND category IS NOT NULL
          GROUP BY category 
          ORDER BY count DESC 
          LIMIT 10
        `,
        
        // 热门方向
        popular_orientations: `
          SELECT 
            orientation,
            COUNT(*) as count,
            COUNT(DISTINCT ip_address) as unique_users
          FROM api_stats 
          WHERE DATE(created_at) BETWEEN ? AND ? AND orientation IS NOT NULL
          GROUP BY orientation 
          ORDER BY count DESC
        `,
        
        // 热门端点
        popular_endpoints: `
          SELECT 
            endpoint,
            method,
            COUNT(*) as count,
            AVG(response_time) as avg_response_time
          FROM api_stats 
          WHERE DATE(created_at) BETWEEN ? AND ?
          GROUP BY endpoint, method 
          ORDER BY count DESC 
          LIMIT 10
        `,
        
        // 状态码分布
        status_distribution: `
          SELECT 
            response_status,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM api_stats WHERE DATE(created_at) BETWEEN ? AND ?), 2) as percentage
          FROM api_stats 
          WHERE DATE(created_at) BETWEEN ? AND ?
          GROUP BY response_status 
          ORDER BY count DESC
        `,
        
        // 热门图片
        popular_images: `
          SELECT 
            i.id,
            i.filename,
            i.category,
            i.orientation,
            COUNT(s.image_id) as requests
          FROM api_stats s
          JOIN images i ON s.image_id = i.id
          WHERE DATE(s.created_at) BETWEEN ? AND ?
          GROUP BY s.image_id 
          ORDER BY requests DESC 
          LIMIT 10
        `
      };
      
      const results = {};
      const params = [startDate, endDate];
      let completed = 0;
      const total = Object.keys(queries).length;
      
      Object.entries(queries).forEach(([key, query]) => {
        // 状态码分布需要4个参数
        const queryParams = key === 'status_distribution' ? [startDate, endDate, startDate, endDate] : params;
        
        this.db.all(query, queryParams, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          results[key] = rows;
          completed++;
          
          if (completed === total) {
            resolve(results);
          }
        });
      });
    });
  }

  getTopIPs(days = 7, limit = 10) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ip_address,
          COUNT(*) as requests,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          MIN(created_at) as first_seen,
          MAX(created_at) as last_seen
        FROM api_stats 
        WHERE DATE(created_at) >= date('now', '-${days} days')
          AND ip_address IS NOT NULL
        GROUP BY ip_address 
        ORDER BY requests DESC 
        LIMIT ?
      `;
      
      this.db.all(query, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getResponseTimeStats(days = 7) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          endpoint,
          COUNT(*) as total_requests,
          AVG(response_time) as avg_response_time,
          MIN(response_time) as min_response_time,
          MAX(response_time) as max_response_time,
          CASE 
            WHEN response_time < 100 THEN 'fast'
            WHEN response_time < 500 THEN 'normal'
            WHEN response_time < 1000 THEN 'slow'
            ELSE 'very_slow'
          END as performance_category
        FROM api_stats 
        WHERE DATE(created_at) >= date('now', '-${days} days')
          AND response_time IS NOT NULL
        GROUP BY endpoint
        ORDER BY avg_response_time DESC
      `;
      
      this.db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
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

  // 优化的统计信息查询 - 避免加载所有图片数据
  async getImageStats() {
    try {
      const [totalResult, landscapeResult, portraitResult, categoriesResult] = await Promise.all([
        new Promise((resolve, reject) => {
          this.db.get('SELECT COUNT(*) as count FROM images', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        }),
        new Promise((resolve, reject) => {
          this.db.get('SELECT COUNT(*) as count FROM images WHERE orientation = "landscape"', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        }),
        new Promise((resolve, reject) => {
          this.db.get('SELECT COUNT(*) as count FROM images WHERE orientation = "portrait"', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        }),
        new Promise((resolve, reject) => {
          this.db.get('SELECT COUNT(DISTINCT category) as count FROM images', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        })
      ]);

      return {
        total: totalResult || 0,
        landscape: landscapeResult || 0,
        portrait: portraitResult || 0,
        categories: categoriesResult || 0
      };
    } catch (error) {
      console.error('getImageStats error:', error);
      throw error;
    }
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

  // 通用查询方法
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // User Management Methods
  async createUser(userData) {
    return new Promise(async (resolve, reject) => {
      try {
        const { 
          username, 
          password, 
          email, 
          role = 'user',  // 默认为普通用户，不是管理员
          permissions = '["view_images", "upload_images"]',
          is_active = 1 
        } = userData;
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = `
          INSERT INTO users (username, password, email, role, permissions, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [username, hashedPassword, email, role, permissions, is_active], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, username, email, role, permissions, is_active });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 注册新用户（公开注册，只给普通用户权限）
  async registerUser(userData) {
    return new Promise(async (resolve, reject) => {
      try {
        const { username, password, email } = userData;
        
        // 检查用户名是否已存在
        const existingUsername = await this.getUserByUsername(username);
        if (existingUsername) {
          return reject(new Error('用户名已存在'));
        }
        
        // 检查邮箱是否已存在
        if (email) {
          const existingEmail = await this.getUserByEmail(email);
          if (existingEmail) {
            return reject(new Error('邮箱已被使用'));
          }
        }
        
        // 创建普通用户（不给管理员权限）
        const userPermissions = JSON.stringify(['view_images', 'upload_images']);
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = `
          INSERT INTO users (username, password, email, role, permissions, is_active, email_verified)
          VALUES (?, ?, ?, 'user', ?, 1, 0)
        `;
        
        this.db.run(query, [username, hashedPassword, email, userPermissions], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              id: this.lastID, 
              username, 
              email, 
              role: 'user', 
              permissions: JSON.parse(userPermissions),
              email_verified: false
            });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 获取用户通过邮箱
  getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 更新用户邮箱
  async updateUserEmail(userId, newEmail) {
    return new Promise(async (resolve, reject) => {
      try {
        // 检查新邮箱是否已被使用
        const existingUser = await this.getUserByEmail(newEmail);
        if (existingUser && existingUser.id !== userId) {
          return reject(new Error('该邮箱已被其他用户使用'));
        }
        
        const query = `
          UPDATE users 
          SET email = ?, email_verified = 0, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;
        
        this.db.run(query, [newEmail, userId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              updated: this.changes > 0, 
              message: '邮箱更新成功，请重新验证' 
            });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 更新用户信息
  async updateUser(userId, updateData) {
    return new Promise((resolve, reject) => {
      const allowedFields = ['email', 'role', 'permissions', 'is_active'];
      const updates = [];
      const values = [];
      
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });
      
      if (updates.length === 0) {
        return reject(new Error('没有可更新的字段'));
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);
      
      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      
      this.db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ updated: this.changes > 0 });
        }
      });
    });
  }

  // 创建用户配置文件
  async createUserProfile(userId, profileData) {
    return new Promise((resolve, reject) => {
      const { display_name, avatar_url, bio, preferences = '{}' } = profileData;
      
      const query = `
        INSERT INTO user_profiles (user_id, display_name, avatar_url, bio, preferences)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          display_name = excluded.display_name,
          avatar_url = excluded.avatar_url,
          bio = excluded.bio,
          preferences = excluded.preferences,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      this.db.run(query, [userId, display_name, avatar_url, bio, preferences], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID || userId, updated: true });
        }
      });
    });
  }

  // 获取用户配置文件
  getUserProfile(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT u.*, p.display_name, p.avatar_url, p.bio, p.preferences
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.id = ? AND u.is_active = 1
      `;
      
      this.db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            // 解析权限和偏好设置
            try {
              row.permissions = JSON.parse(row.permissions || '[]');
              row.preferences = JSON.parse(row.preferences || '{}');
            } catch (e) {
              row.permissions = [];
              row.preferences = {};
            }
          }
          resolve(row);
        }
      });
    });
  }

  // 检查用户权限
  checkUserPermission(userId, permission) {
    return new Promise(async (resolve, reject) => {
      try {
        const user = await this.getUserById(userId);
        if (!user) {
          return resolve(false);
        }
        
        // 管理员拥有所有权限
        if (user.role === 'admin') {
          return resolve(true);
        }
        
        // 检查用户特定权限
        const permissions = JSON.parse(user.permissions || '[]');
        resolve(permissions.includes(permission));
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

  // 禁用/启用用户（软删除）
  disableUser(id) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE users SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, action: 'disabled' });
        }
      });
    });
  }

  // 启用用户
  enableUser(id) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE users SET is_active = 1 WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, action: 'enabled' });
        }
      });
    });
  }

  // 切换用户状态
  toggleUserStatus(id) {
    return new Promise((resolve, reject) => {
      // 先获取当前状态
      this.db.get('SELECT is_active FROM users WHERE id = ?', [id], (err, user) => {
        if (err) {
          reject(err);
          return;
        }
        if (!user) {
          reject(new Error('用户不存在'));
          return;
        }

        const newStatus = user.is_active === 1 ? 0 : 1;
        const action = newStatus === 1 ? 'enabled' : 'disabled';

        this.db.run('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              changes: this.changes, 
              action,
              new_status: newStatus,
              message: `用户已${action === 'enabled' ? '启用' : '禁用'}`
            });
          }
        });
      });
    });
  }

  // 真正删除用户（硬删除）
  deleteUser(id) {
    return new Promise((resolve, reject) => {
      // 先检查是否是管理员
      this.db.get('SELECT role FROM users WHERE id = ?', [id], (err, user) => {
        if (err) {
          reject(err);
          return;
        }
        if (!user) {
          reject(new Error('用户不存在'));
          return;
        }
        if (user.role === 'admin') {
          reject(new Error('不能删除管理员账户'));
          return;
        }

        // 执行删除
        this.db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes, action: 'deleted' });
          }
        });
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

  // Password Reset Methods
  createPasswordResetToken(userId, token, expiresAt) {
    return new Promise((resolve, reject) => {
      // 先清理该用户的旧token
      this.db.run('DELETE FROM password_resets WHERE user_id = ?', [userId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 创建新的重置token
        const query = `
          INSERT INTO password_resets (user_id, token, expires_at)
          VALUES (?, ?, ?)
        `;
        
        this.db.run(query, [userId, token, expiresAt], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              user_id: userId,
              token,
              expires_at: expiresAt
            });
          }
        });
      });
    });
  }

  findPasswordResetToken(token) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT pr.*, u.username, u.email 
        FROM password_resets pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.token = ? AND pr.used = 0 AND pr.expires_at > datetime('now')
      `;
      
      this.db.get(query, [token], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  usePasswordResetToken(token) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE password_resets SET used = 1 WHERE token = ?', [token], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  findUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
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