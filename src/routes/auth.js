const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const Database = require('../models/Database');
const CaptchaService = require('../utils/captcha');
const EmailService = require('../utils/emailService');
const { authenticateSession, generateToken, validatePassword } = require('../middleware/auth');

const router = express.Router();
const db = new Database();
const captchaService = new CaptchaService();
const emailService = new EmailService();

// 添加multer来处理multipart/form-data
const upload = multer();

// 登录限流
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制每个IP 15分钟内最多5次登录尝试
  message: { error: '登录尝试过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 获取验证码
router.get('/captcha', (req, res) => {
  try {
    const captcha = captchaService.generateCaptcha();
    res.json({
      id: captcha.id,
      svg: captcha.svg,
      expiresAt: captcha.expiresAt
    });
  } catch (error) {
    console.error('Generate captcha error:', error);
    res.status(500).json({ error: '生成验证码失败' });
  }
});

// 用户登录
router.post('/login', loginLimiter, upload.none(), async (req, res) => {
  try {
    console.log('Login request received:');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Content-Type:', req.get('Content-Type'));
    
    const { username, password, captchaId, captchaText } = req.body;

    console.log('Extracted values:', {
      username: username || '(empty)',
      password: password ? '***' : '(empty)',
      captchaId: captchaId || '(empty)',
      captchaText: captchaText || '(empty)'
    });

    if (!username || !password || !captchaId || !captchaText) {
      console.log('Missing required fields');
      return res.status(400).json({ error: '请填写完整信息' });
    }

    // 验证验证码
    const captchaResult = captchaService.verifyCaptcha(captchaId, captchaText);
    if (!captchaResult.success) {
      console.log(`验证码验证失败: ${captchaResult.error}, IP: ${req.ip}`);
      return res.status(400).json({ error: captchaResult.error });
    }
    console.log('验证码验证通过');

    // 验证用户
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间
    await db.updateLastLogin(user.id);

    // 创建会话
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    // 生成JWT令牌（用于API访问）
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录服务错误' });
  }
});

// 用户登出
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: '登出失败' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: '登出成功' });
  });
});

// 检查登录状态
router.get('/status', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      isLoggedIn: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role
      }
    });
  } else {
    res.json({ isLoggedIn: false });
  }
});

// 修改密码
router.post('/change-password', authenticateSession, upload.none(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请填写当前密码和新密码' });
    }

    // 验证新密码强度
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // 获取当前用户
    const user = await db.getUserById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证当前密码
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    // 更新密码
    await db.updateUser(user.id, { password: newPassword });

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 获取所有用户（需要管理员权限）
router.get('/users', authenticateSession, async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const users = await db.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 创建用户（需要管理员权限）
router.post('/users', authenticateSession, upload.none(), async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const { username, password, email, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码是必填项' });
    }

    // 验证密码强度
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    const user = await db.createUser({ username, password, email, role });
    res.json({ success: true, user });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: '用户名已存在' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

// 更新用户（需要管理员权限）
router.put('/users/:id', authenticateSession, async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const userId = req.params.id;
    const updateData = req.body;

    // 如果要更新密码，验证密码强度
    if (updateData.password) {
      const passwordValidation = validatePassword(updateData.password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }
    }

    await db.updateUser(userId, updateData);
    res.json({ success: true, message: '用户更新成功' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '更新用户失败' });
  }
});

// 删除用户（需要管理员权限）
router.delete('/users/:id', authenticateSession, async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const userId = req.params.id;

    // 不能删除自己
    if (parseInt(userId) === req.session.userId) {
      return res.status(400).json({ error: '不能删除自己的账户' });
    }

    await db.deleteUser(userId);
    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// 获取访问控制规则
router.get('/access-rules', authenticateSession, async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const rules = await db.getAllAccessRules();
    res.json(rules);
  } catch (error) {
    console.error('Get access rules error:', error);
    res.status(500).json({ error: '获取访问规则失败' });
  }
});

// 添加访问控制规则
router.post('/access-rules', authenticateSession, upload.none(), async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const { type, value, action, description } = req.body;

    if (!type || !value || !action) {
      return res.status(400).json({ error: '类型、值和动作是必填项' });
    }

    if (!['ip', 'domain'].includes(type)) {
      return res.status(400).json({ error: '类型必须是 ip 或 domain' });
    }

    if (!['allow', 'deny'].includes(action)) {
      return res.status(400).json({ error: '动作必须是 allow 或 deny' });
    }

    const rule = await db.addAccessRule({ type, value, action, description });
    res.json({ success: true, rule });
  } catch (error) {
    console.error('Add access rule error:', error);
    res.status(500).json({ error: '添加访问规则失败' });
  }
});

// 更新访问控制规则
router.put('/access-rules/:id', authenticateSession, async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const ruleId = req.params.id;
    const updateData = req.body;

    await db.updateAccessRule(ruleId, updateData);
    res.json({ success: true, message: '访问规则更新成功' });
  } catch (error) {
    console.error('Update access rule error:', error);
    res.status(500).json({ error: '更新访问规则失败' });
  }
});

// 删除访问控制规则
router.delete('/access-rules/:id', authenticateSession, async (req, res) => {
  try {
    if (req.session.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }

    const ruleId = req.params.id;
    await db.deleteAccessRule(ruleId);
    res.json({ success: true, message: '访问规则删除成功' });
  } catch (error) {
    console.error('Delete access rule error:', error);
    res.status(500).json({ error: '删除访问规则失败' });
  }
});

// 用户注册
router.post('/register', rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 3, // 每15分钟最多3次注册请求
  message: { error: '注册请求过于频繁，请稍后再试' }
}), upload.none(), async (req, res) => {
  try {
    // 检查注册是否启用
    const registrationEnabled = await db.isRegistrationEnabled();
    if (!registrationEnabled) {
      return res.status(403).json({ 
        error: '注册功能已被管理员禁用',
        code: 'REGISTRATION_DISABLED'
      });
    }

    // 检查是否在维护模式
    const maintenanceMode = await db.isMaintenanceMode();
    if (maintenanceMode) {
      return res.status(503).json({ 
        error: '网站正在维护中，暂时无法注册',
        code: 'MAINTENANCE_MODE'
      });
    }

    // 检查用户数量限制
    const maxUsers = await db.getMaxUsersLimit();
    const allUsers = await db.getAllUsers();
    const activeUsers = allUsers.filter(user => user.is_active === 1);
    
    if (activeUsers.length >= maxUsers) {
      return res.status(403).json({ 
        error: `用户数量已达到上限（${maxUsers}），无法注册新用户`,
        code: 'USER_LIMIT_REACHED'
      });
    }

    const { username, email, password, confirmPassword, captchaId, captchaText } = req.body;

    // 验证必填字段
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    // 验证密码确认
    if (password !== confirmPassword) {
      return res.status(400).json({ error: '两次输入的密码不一致' });
    }

    // 验证密码强度
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }

    // 验证用户名格式（只允许字母、数字、下划线，3-20位）
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: '用户名只能包含字母、数字、下划线，长度3-20位' });
    }

    // 验证验证码（如果启用）
    if (captchaId && captchaText) {
      const captchaResult = captchaService.verifyCaptcha(captchaId, captchaText);
      if (!captchaResult.success) {
        return res.status(400).json({ error: captchaResult.error });
      }
    }

    // 检查用户名是否已存在
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查邮箱是否已存在
    const existingEmail = await db.findUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: '邮箱已被注册' });
    }

    // 创建用户（默认为普通用户角色）
    const requireApproval = await db.isRegistrationApprovalRequired();
    const user = await db.createUser({
      username,
      email,
      password,
      role: 'user',
      is_active: requireApproval ? 0 : 1 // 如果需要审核，创建时设为未激活
    });

    // 发送欢迎邮件
    const emailResult = await emailService.sendWelcomeEmail(email, username);
    
    if (emailResult.success) {
      console.log(`Welcome email sent to ${email}:`, emailResult.messageId);
    } else {
      console.error('Failed to send welcome email:', emailResult.error);
    }

    const message = requireApproval 
      ? '注册成功！您的账户正在等待管理员审核，审核通过后您将收到邮件通知'
      : '注册成功！欢迎邮件已发送到您的邮箱';

    res.json({
      success: true,
      message,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: requireApproval ? 0 : 1,
        require_approval: requireApproval
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }
    res.status(500).json({ error: '注册失败，请稍后再试' });
  }
});

// 检查用户名是否可用
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username || username.length < 3) {
      return res.json({ available: false, message: '用户名至少需要3个字符' });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.json({ available: false, message: '用户名只能包含字母、数字、下划线' });
    }

    const existingUser = await db.getUserByUsername(username);
    res.json({ 
      available: !existingUser,
      message: existingUser ? '用户名已被使用' : '用户名可用'
    });

  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ error: '检查用户名失败' });
  }
});

// 检查邮箱是否可用
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.json({ available: false, message: '请输入有效的邮箱地址' });
    }

    const existingUser = await db.findUserByEmail(email);
    res.json({ 
      available: !existingUser,
      message: existingUser ? '邮箱已被注册' : '邮箱可用'
    });

  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ error: '检查邮箱失败' });
  }
});

router.post('/forgot-password', rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 3, // 每15分钟最多3次请求
  message: { error: '重置密码请求过于频繁，请稍后再试' }
}), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: '请输入邮箱地址' });
    }

    // 查找用户
    const user = await db.findUserByEmail(email);
    if (!user) {
      // 为了安全，不透露用户是否存在，统一返回成功
      return res.json({ 
        success: true, 
        message: '如果该邮箱已注册，重置链接已发送' 
      });
    }

    // 生成重置token（32字节随机字符串）
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // 设置过期时间为1小时后
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // 保存重置token到数据库
    await db.createPasswordResetToken(user.id, resetToken, expiresAt);

    // 发送密码重置邮件
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
    const emailResult = await emailService.sendPasswordResetEmail(user.email, resetUrl, user.username);
    
    if (emailResult.success) {
      console.log(`Password reset email sent to ${email}:`, emailResult.messageId);
      
      res.json({ 
        success: true, 
        message: '重置链接已发送到您的邮箱',
        // 在开发环境下返回测试链接
        ...(process.env.NODE_ENV !== 'production' && emailResult.testUrl && { 
          testUrl: emailResult.testUrl,
          resetUrl 
        })
      });
    } else {
      // 邮件发送失败，但不暴露具体错误给用户
      console.error('Failed to send password reset email:', emailResult.error);
      res.json({ 
        success: true, 
        message: '重置链接已发送到您的邮箱' // 为了安全，仍然返回成功消息
      });
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: '发送重置链接失败' });
  }
});

// 验证重置token
router.get('/validate-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: '缺少重置token' });
    }

    const resetRecord = await db.findPasswordResetToken(token);
    
    if (!resetRecord) {
      return res.status(400).json({ error: '重置链接无效或已过期' });
    }

    res.json({ 
      success: true, 
      message: 'Token有效',
      email: resetRecord.email 
    });

  } catch (error) {
    console.error('Validate reset token error:', error);
    res.status(500).json({ error: '验证重置链接失败' });
  }
});

// 重置密码
router.post('/reset-password', rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每15分钟最多5次重置尝试
  message: { error: '重置密码尝试过于频繁，请稍后再试' }
}), async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: '缺少重置token或新密码' });
    }

    // 验证密码强度
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // 验证并获取重置token信息
    const resetRecord = await db.findPasswordResetToken(token);
    
    if (!resetRecord) {
      return res.status(400).json({ error: '重置链接无效或已过期' });
    }

    // 更新用户密码
    await db.updateUser(resetRecord.user_id, { password });

    // 标记token为已使用
    await db.usePasswordResetToken(token);

    res.json({ 
      success: true, 
      message: '密码重置成功，请使用新密码登录' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: '重置密码失败' });
  }
});

module.exports = router;