const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const { checkAccess, authenticateSession } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false, // 禁用CSP以支持内联样式
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" } // 允许跨域访问资源
}));

// 信任代理（用于获取真实IP）
app.set('trust proxy', 1);

// 全局限流
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 限制每个IP 15分钟内最多1000次请求
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// CORS配置 - 默认允许所有跨域
app.use(cors({
  origin: function (origin, callback) {
    // 允许所有来源，包括没有origin的请求（如移动应用）
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 会话配置
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 生产环境中使用HTTPS时设为true
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 访问控制中间件（应用于所有路由）
app.use(checkAccess);

// API路由
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);

// 管理后台路由保护
app.use('/admin*', authenticateSession);

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
    pid: process.pid
  });
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

// 测试登录页面
app.get('/test-login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test-login.html'));
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '页面未找到' });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`Random Image API server is running on port ${PORT}`);
  console.log(`Login page: http://localhost:${PORT}/login`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`API endpoint: http://localhost:${PORT}/api/random`);
  console.log(`Default admin account: admin/admin123`);
});