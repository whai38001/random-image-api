const winston = require('winston');
const path = require('path');

/**
 * 结构化日志系统
 */
class Logger {
  constructor() {
    // 定义日志格式
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          log += ` | Meta: ${JSON.stringify(meta)}`;
        }
        
        if (stack) {
          log += `\nStack: ${stack}`;
        }
        
        return log;
      })
    );

    // 创建winston logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        // 控制台输出
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        
        // 错误日志文件
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          format: winston.format.json()
        }),
        
        // 所有日志文件
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 10,
          format: winston.format.json()
        }),
        
        // 访问日志文件
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'access.log'),
          level: 'http',
          maxsize: 10485760, // 10MB
          maxFiles: 7,
          format: winston.format.json()
        })
      ],
      
      // 异常和拒绝处理
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'exceptions.log')
        })
      ],
      
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'rejections.log')
        })
      ]
    });

    // 创建logs目录（如果不存在）
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const fs = require('fs');
    const logsDir = path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  // 基础日志方法
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  http(message, meta = {}) {
    this.logger.http(message, meta);
  }

  // 特定场景的日志方法
  security(message, details = {}) {
    this.logger.warn(`[SECURITY] ${message}`, {
      type: 'security',
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  performance(message, metrics = {}) {
    this.logger.info(`[PERFORMANCE] ${message}`, {
      type: 'performance',
      timestamp: new Date().toISOString(),
      ...metrics
    });
  }

  apiAccess(req, res, responseTime) {
    this.logger.http('API_ACCESS', {
      type: 'api_access',
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date().toISOString(),
      userId: req.user?.id || null,
      contentLength: res.get('Content-Length') || 0
    });
  }

  fileUpload(filename, fileSize, uploadTime, userId) {
    this.logger.info('FILE_UPLOAD', {
      type: 'file_upload',
      filename,
      fileSize,
      uploadTime,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  databaseQuery(query, duration, rowCount = null) {
    if (duration > 1000) { // 记录慢查询
      this.logger.warn('SLOW_QUERY', {
        type: 'slow_query',
        query: query.substring(0, 200), // 截断长查询
        duration,
        rowCount,
        timestamp: new Date().toISOString()
      });
    }
  }

  userAction(action, userId, details = {}) {
    this.logger.info('USER_ACTION', {
      type: 'user_action',
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  systemEvent(event, data = {}) {
    this.logger.info(`SYSTEM_EVENT: ${event}`, {
      type: 'system_event',
      event,
      timestamp: new Date().toISOString(),
      ...data
    });
  }
}

module.exports = new Logger();