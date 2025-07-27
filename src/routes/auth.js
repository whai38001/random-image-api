const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const Database = require('../models/Database');
const CaptchaService = require('../utils/captcha');
const { authenticateSession, generateToken, validatePassword } = require('../middleware/auth');

const router = express.Router();
const db = new Database();
const captchaService = new CaptchaService();

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

    // 临时禁用验证码验证，直接通过
    // 验证验证码
    // const captchaResult = captchaService.verifyCaptcha(captchaId, captchaText);
    // if (!captchaResult.success) {
    //   return res.status(400).json({ error: captchaResult.error });
    // }
    console.log('Captcha verification temporarily disabled');

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

module.exports = router;