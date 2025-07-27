const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const thumbnailRoutes = require('./routes/thumbnails');
const systemRoutes = require('./routes/system');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const AnalyticsMiddleware = require('./middleware/analytics');
const SecurityMiddleware = require('./middleware/security');
const { checkAccess, authenticateSession } = require('./middleware/auth');

// 导入监控和日志系统
const logger = require('./utils/logger');
const performanceMonitor = require('./utils/performanceMonitor');
const { errorHandler, notFoundHandler } = require('./utils/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// 初始化分析中间件
const analyticsMiddleware = new AnalyticsMiddleware();

// 初始化安全中间件
const securityMiddleware = new SecurityMiddleware();

// 暴露安全中间件到全局，供管理工具使用
global.securityMiddleware = securityMiddleware;

// 初始化缩略图服务
const ThumbnailService = require('./services/ThumbnailService');
const thumbnailService = new ThumbnailService();

// 安全中间件 - HTTPS环境配置  
app.use((req, res, next) => {
  // 对于管理页面，使用更宽松的CSP
  if (req.path.startsWith('/admin')) {
    helmet({
      contentSecurityPolicy: false, // 对管理页面禁用CSP
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    })(req, res, next);
  } else {
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          scriptSrcAttr: ["'self'", "'unsafe-inline'"],
          styleSrcAttr: ["'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
          connectSrc: ["'self'", "https://www.google-analytics.com", "https://analytics.google.com"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    })(req, res, next);
  }
});

// 信任代理（用于获取真实IP）
app.set('trust proxy', 1);

// 🔧 性能监控中间件 - 在所有其他中间件之前
app.use(performanceMonitor.trackRequest());

// 全局限流 - 更严格的配置
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 限制每个IP 15分钟内最多1000次请求
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  // 跳过某些路径
  skip: (req) => {
    const skipPaths = ['/health', '/favicon.ico'];
    return skipPaths.includes(req.path);
  }
});

// API专用限流 - 更严格
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 60, // 每分钟最多60次请求
  message: { error: 'API调用频率过高，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

// 认证相关的严格限流
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 认证相关操作最多10次
  message: { error: '认证操作过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // 成功的请求不计入限制
});

app.use(globalLimiter);

// CORS配置 - 支持HTTPS反向代理
app.use(cors({
  origin: function (origin, callback) {
    // 允许的域名列表
    const allowedOrigins = [
      'https://rp.itdianbao.com',
      'http://localhost:3001',
      'http://127.0.0.1:3001'
    ];
    
    // 允许没有origin的请求（如移动应用、API工具）
    if (!origin) return callback(null, true);
    
    // 检查origin是否在允许列表中
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // 开发环境允许所有localhost
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, true); // 暂时允许所有，可根据需要调整
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Forwarded-For', 'X-Real-IP']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 会话配置 - 强制要求SESSION_SECRET环境变量
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error('❌ 错误: SESSION_SECRET 环境变量是必需的!');
  console.error('请设置: export SESSION_SECRET=your-super-secret-key');
  process.exit(1);
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // 生产环境启用secure cookies
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24小时
    sameSite: 'lax' // HTTPS环境下的CSRF保护
  }
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 访问控制中间件（应用于所有路由）
app.use(checkAccess);

// 维护模式检查中间件
app.use(async (req, res, next) => {
  try {
    // 跳过某些路径和管理员会话
    const skipPaths = ['/health', '/favicon.ico', '/admin', '/login', '/auth/login', '/auth/status'];
    const isSkipPath = skipPaths.some(path => req.path.startsWith(path));
    
    if (isSkipPath) {
      return next();
    }
    
    // 检查是否为管理员会话
    if (req.session && req.session.role === 'admin') {
      return next();
    }
    
    // 检查维护模式
    const Database = require('./models/Database');
    const db = new Database();
    const maintenanceMode = await db.isMaintenanceMode();
    
    if (maintenanceMode) {
      if (req.path.startsWith('/api/')) {
        return res.status(503).json({ 
          error: '系统维护中，请稍后再试',
          maintenance: true 
        });
      } else {
        return res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>系统维护中</title>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; }
              .maintenance { max-width: 500px; margin: 0 auto; padding: 40px; }
              .icon { font-size: 64px; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 20px; }
              p { color: #666; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="maintenance">
              <div class="icon">🔧</div>
              <h1>系统维护中</h1>
              <p>我们正在对系统进行维护升级，预计很快就会完成。<br>给您带来的不便，我们深表歉意。</p>
              <p>如有紧急情况，请联系管理员。</p>
            </div>
          </body>
          </html>
        `);
      }
    }
    
    next();
  } catch (error) {
    console.error('Maintenance check error:', error);
    next();
  }
});

// 安全检测中间件（检测可疑活动）
app.use(securityMiddleware.detectSuspiciousActivity());

// 分析中间件（记录API使用情况）
app.use(analyticsMiddleware.trackRequest());

// API路由 - 应用API专用限流
app.use('/api', apiLimiter, apiRoutes);
app.use('/api/search', apiLimiter, searchRoutes);
app.use('/auth', authLimiter, authRoutes);

// 设置安全中间件实例并应用analytics路由
analyticsRoutes.setSecurityMiddleware(securityMiddleware);
app.use('/analytics', analyticsRoutes);

// 缩略图管理路由
app.use('/thumbnails', thumbnailRoutes);

// 系统配置路由
app.use('/system', systemRoutes);

// 管理员管理路由
app.use('/admin', adminRoutes);

// 管理后台路由保护
app.use('/admin*', authenticateSession);

// 🏥 增强健康检查端点
app.get('/health', (req, res) => {
  const healthStatus = performanceMonitor.healthCheck();
  const statusCode = healthStatus.status === 'healthy' ? 200 : 
                     healthStatus.status === 'warning' ? 200 : 503;
  
  res.status(statusCode).json({
    ...healthStatus,
    port: PORT,
    pid: process.pid,
    nodeVersion: process.version,
    uptime: process.uptime()
  });
});

// 📊 性能监控端点（需要认证）
app.get('/monitoring/metrics', authenticateSession, (req, res) => {
  try {
    const report = performanceMonitor.getPerformanceReport();
    res.json(report);
  } catch (error) {
    logger.error('Failed to get performance metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

// 📈 系统状态端点
app.get('/monitoring/status', authenticateSession, (req, res) => {
  try {
    const systemMetrics = performanceMonitor.getSystemMetrics();
    res.json(systemMetrics);
  } catch (error) {
    logger.error('Failed to get system status', { error: error.message });
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// 系统信息页面
app.get('/system-info', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/system-info.html'));
});

// 根路径显示API文档
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/api-docs.html'));
});

// 管理后台
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// 登录页面
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// 注册页面
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

// 忘记密码页面
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/forgot-password.html'));
});

// 重置密码页面
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/reset-password.html'));
});

// 测试登录页面
app.get('/test-login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test-login.html'));
});

// 🚫 404处理 - 使用标准化响应
app.use(notFoundHandler);

// 🔥 全局错误处理 - 使用标准化错误处理
app.use(errorHandler);

app.listen(PORT, () => {
  // 🚀 启动日志
  logger.systemEvent('server_started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    pid: process.pid
  });
  
  console.log(`🚀 Random Image API server is running on port ${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Login page: http://localhost:${PORT}/login`);
  console.log(`👤 Register page: http://localhost:${PORT}/register`);
  console.log(`⚙️  Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🔗 API endpoint: http://localhost:${PORT}/api/random`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Monitoring: http://localhost:${PORT}/monitoring/metrics`);
  console.log(`👑 Default admin account: admin/admin123`);
  
  // 生产环境安全提醒
  if (process.env.NODE_ENV === 'production') {
    console.log('\n🛡️  Production Environment Security Checklist:');
    console.log('✅ Change default admin password');
    console.log('✅ Set custom SESSION_SECRET');
    console.log('✅ Configure HTTPS (set HTTPS=true)');
    console.log('✅ Review access control settings');
    console.log('✅ Configure email service (SMTP settings)');
    
    logger.security('Production server started', {
      port: PORT,
      nodeVersion: process.version,
      pid: process.pid
    });
  } else {
    console.log('\n⚠️  Development Environment - Use production script for deployment');
  }
  
  console.log('\n📊 监控系统已启用：');
  console.log('- 📈 实时性能监控');
  console.log('- 📝 结构化日志记录');
  console.log('- 🔍 健康检查端点');
  console.log('- ⚡ 响应时间追踪');

  // 启动定时任务更新日统计（每小时执行一次）
  setInterval(async () => {
    try {
      await analyticsMiddleware.updateDailyStatsTask();
      logger.systemEvent('daily_stats_updated');
      console.log('📊 Daily statistics updated automatically');
    } catch (error) {
      logger.error('Auto update daily stats failed', { error: error.message });
      console.error('❌ Auto update daily stats failed:', error);
    }
  }, 60 * 60 * 1000); // 1小时

  // 启动安全清理任务（每6小时清理一次过期记录）
  setInterval(() => {
    try {
      securityMiddleware.cleanupSuspiciousRecords();
      console.log('🔒 Security records cleaned up automatically');
    } catch (error) {
      console.error('❌ Auto security cleanup failed:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6小时

  // 启动缩略图维护任务（每12小时检查一次）
  setInterval(async () => {
    try {
      console.log('🔧 Starting scheduled thumbnail maintenance...');
      
      // 清理孤立的缩略图
      const cleanupResult = await thumbnailService.cleanupOrphanedThumbnails();
      if (cleanupResult.cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleanupResult.cleaned} orphaned thumbnails`);
      }
      
      // 修复损坏的缩略图
      const repairResult = await thumbnailService.repairCorruptedThumbnails();
      if (repairResult.repaired > 0) {
        console.log(`🔧 Repaired ${repairResult.repaired} corrupted thumbnails`);
      }
      
      console.log('✅ Thumbnail maintenance completed');
    } catch (error) {
      console.error('❌ Thumbnail maintenance failed:', error);
    }
  }, 12 * 60 * 60 * 1000); // 12小时

  // 启动时立即更新一次统计
  setTimeout(async () => {
    try {
      await analyticsMiddleware.updateDailyStatsTask();
      console.log('📊 Initial daily statistics updated');
    } catch (error) {
      console.error('❌ Initial stats update failed:', error);
    }
  }, 5000); // 5秒后执行

  // 启动时检查缩略图状态并生成缺失的缩略图
  setTimeout(async () => {
    try {
      console.log('🔍 Checking thumbnail status...');
      const stats = await thumbnailService.getThumbnailStats();
      console.log(`📊 Thumbnail stats: ${stats.withThumbnails}/${stats.total} images have thumbnails (${stats.coverage}% coverage)`);
      
      if (stats.withoutThumbnails > 0) {
        console.log(`🔄 Starting background thumbnail generation for ${stats.withoutThumbnails} images...`);
        
        // 异步生成缺失的缩略图，不阻塞启动
        thumbnailService.generateMissingThumbnails()
          .then(summary => {
            console.log('✅ Background thumbnail generation completed:', summary);
          })
          .catch(error => {
            console.error('❌ Background thumbnail generation failed:', error);
          });
      } else {
        console.log('✅ All images have thumbnails');
      }
    } catch (error) {
      console.error('❌ Thumbnail check failed:', error);
    }
  }, 10000); // 10秒后执行，给数据库初始化时间
});