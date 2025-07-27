const jwt = require('jsonwebtoken');
const Database = require('../models/Database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const db = new Database();

// JWT认证中间件
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: '访问令牌不存在' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: '用户不存在或已被禁用' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '访问令牌已过期' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的访问令牌' });
    }
    return res.status(500).json({ error: '认证服务错误' });
  }
};

// 会话认证中间件（用于管理后台）
const authenticateSession = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: '请先登录' });
  }
};

// 访问控制中间件
const checkAccess = async (req, res, next) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const host = req.get('host') || req.hostname;
    
    const accessCheck = await db.checkAccess(clientIp, host);
    
    if (!accessCheck.allowed) {
      console.log(`Access denied for IP: ${clientIp}, Host: ${host}, Rule: ${accessCheck.rule?.description || 'Unknown'}`);
      return res.status(403).json({ 
        error: '访问被拒绝', 
        reason: accessCheck.rule?.description || '您的IP或域名已被限制访问'
      });
    }
    
    next();
  } catch (error) {
    console.error('Access control error:', error);
    // 访问控制出错时默认允许访问，避免系统不可用
    next();
  }
};

// 生成JWT令牌
const generateToken = (userId) => {
  return jwt.sign(
    { userId: userId },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// 验证密码强度
const validatePassword = (password) => {
  if (password.length < 6) {
    return { valid: false, message: '密码长度至少6位' };
  }
  
  if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
    return { valid: false, message: '密码必须包含字母和数字' };
  }
  
  return { valid: true };
};

module.exports = {
  authenticateToken,
  authenticateSession,
  checkAccess,
  generateToken,
  validatePassword,
  JWT_SECRET
};