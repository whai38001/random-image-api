const express = require('express');
const Database = require('../models/Database');
const { authenticateSession } = require('../middleware/auth');

const router = express.Router();
const db = new Database();

// 中间件：只允许管理员访问
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 获取所有系统配置
router.get('/', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const configs = await db.getAllSystemConfigs();
    res.json(configs);
  } catch (error) {
    console.error('Get system configs error:', error);
    res.status(500).json({ error: '获取系统配置失败' });
  }
});

// 获取特定配置
router.get('/:key', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const config = await db.getSystemConfig(req.params.key);
    if (!config) {
      return res.status(404).json({ error: '配置项不存在' });
    }
    res.json(config);
  } catch (error) {
    console.error('Get system config error:', error);
    res.status(500).json({ error: '获取配置失败' });
  }
});

// 设置/更新配置
router.post('/', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { config_key, config_value, description } = req.body;
    
    if (!config_key || config_value === undefined) {
      return res.status(400).json({ error: '配置键和值是必填项' });
    }

    // 验证配置值的有效性
    const validationResult = validateConfigValue(config_key, config_value);
    if (!validationResult.valid) {
      return res.status(400).json({ error: validationResult.error });
    }

    const result = await db.setSystemConfig(
      config_key, 
      config_value, 
      description, 
      req.session.userId
    );
    
    res.json({
      success: true,
      message: '配置更新成功',
      config: result
    });
  } catch (error) {
    console.error('Set system config error:', error);
    res.status(500).json({ error: '设置配置失败' });
  }
});

// 删除配置
router.delete('/:key', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    
    // 防止删除关键配置
    const protectedKeys = ['registration_enabled', 'site_maintenance'];
    if (protectedKeys.includes(key)) {
      return res.status(403).json({ error: '此配置项受保护，不能删除' });
    }

    const result = await db.deleteSystemConfig(key);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '配置项不存在' });
    }
    
    res.json({
      success: true,
      message: '配置删除成功'
    });
  } catch (error) {
    console.error('Delete system config error:', error);
    res.status(500).json({ error: '删除配置失败' });
  }
});

// 批量更新配置
router.put('/batch', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { configs } = req.body;
    
    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: '配置必须是数组格式' });
    }

    const results = [];
    const errors = [];
    const warnings = [];

    for (const config of configs) {
      try {
        const { config_key, config_value, description } = config;
        
        if (!config_key || config_value === undefined) {
          warnings.push(`配置 ${config_key} 缺少必要字段，已跳过`);
          continue;
        }

        // 验证配置值
        const validationResult = validateConfigValue(config_key, config_value);
        if (!validationResult.valid) {
          warnings.push(`配置 ${config_key}: ${validationResult.error}，已跳过`);
          continue;
        }

        // 使用默认值（如果有），但优先使用用户提供的值
        const finalValue = config_value !== undefined && config_value !== '' ? config_value : (validationResult.defaultValue || config_value);

        const result = await db.setSystemConfig(
          config_key, 
          finalValue, 
          description, 
          req.session.userId
        );
        
        results.push(result);
      } catch (error) {
        errors.push(`配置 ${config.config_key} 更新失败: ${error.message}`);
      }
    }

    // 只有当真正的保存操作失败时才返回失败状态
    // 验证错误只作为警告，不影响整体成功状态
    const hasSuccessfulSaves = results.length > 0;
    const hasCriticalErrors = errors.length > 0;
    
    res.json({
      success: hasSuccessfulSaves && !hasCriticalErrors,
      message: hasSuccessfulSaves 
        ? (hasCriticalErrors ? '部分配置保存成功，但有些配置保存失败' : '配置保存成功') 
        : '没有配置被保存',
      results,
      errors,
      warnings
    });
  } catch (error) {
    console.error('Batch update configs error:', error);
    res.status(500).json({ error: '批量更新配置失败' });
  }
});

// 获取注册状态（公开接口，用于前端显示）
router.get('/public/registration-status', async (req, res) => {
  try {
    const registrationEnabled = await db.isRegistrationEnabled();
    const maintenanceMode = await db.isMaintenanceMode();
    const maxUsers = await db.getMaxUsersLimit();
    
    // 获取当前用户数量
    const allUsers = await db.getAllUsers();
    const activeUsers = allUsers.filter(user => user.is_active === 1);
    
    // 获取注册消息
    const messageConfig = await db.getSystemConfig('registration_message');
    const registrationMessage = messageConfig ? messageConfig.config_value : '欢迎注册 Random Image API！';

    res.json({
      registration_enabled: registrationEnabled,
      maintenance_mode: maintenanceMode,
      user_limit_reached: activeUsers.length >= maxUsers,
      current_users: activeUsers.length,
      max_users: maxUsers,
      registration_message: registrationMessage
    });
  } catch (error) {
    console.error('Get registration status error:', error);
    res.status(500).json({ error: '获取注册状态失败' });
  }
});

// 审核用户注册
router.post('/approve-user/:userId', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { approved } = req.body;
    
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (user.is_active === 1) {
      return res.status(400).json({ error: '用户已经是激活状态' });
    }

    if (approved) {
      // 批准用户
      await db.updateUser(userId, { is_active: 1 });
      
      // 发送批准邮件
      // TODO: 实现批准邮件发送
      
      res.json({
        success: true,
        message: '用户审核通过',
        user: { ...user, is_active: 1 }
      });
    } else {
      // 拒绝用户（删除用户记录）
      await db.deleteUser(userId);
      
      // 发送拒绝邮件
      // TODO: 实现拒绝邮件发送
      
      res.json({
        success: true,
        message: '用户注册已拒绝'
      });
    }
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ error: '审核用户失败' });
  }
});

// 获取待审核用户列表
router.get('/pending-users', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.getAllUsers();
    const pendingUsers = allUsers.filter(user => user.is_active === 0);
    
    res.json({
      pending_users: pendingUsers,
      count: pendingUsers.length
    });
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ error: '获取待审核用户失败' });
  }
});

// 获取系统信息（公开接口，用于系统信息页面）
router.get('/public/system-info', async (req, res) => {
  try {
    // 获取图片统计
    const imageStats = await db.getImageStats();
    
    // 获取用户统计
    const allUsers = await db.getAllUsers();
    const activeUsers = allUsers.filter(user => user.is_active === 1);
    
    // 获取系统配置
    const registrationEnabled = await db.isRegistrationEnabled();
    const maintenanceMode = await db.isMaintenanceMode();
    const maxUsers = await db.getMaxUsersLimit();
    
    // 获取所有图片进行分类统计
    const allImages = await db.getAllImages();
    const localImages = allImages.filter(img => img.is_local === 1);
    const urlImages = allImages.filter(img => img.is_local === 0);
    
    // 分类统计
    const categoryStats = {};
    allImages.forEach(img => {
      if (img.category) {
        categoryStats[img.category] = (categoryStats[img.category] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        // 图片统计
        images: {
          total: imageStats.total || 0,
          landscape: imageStats.landscape || 0,
          portrait: imageStats.portrait || 0,
          categories: imageStats.categories || 0,
          local: localImages.length,
          url: urlImages.length,
          categoryDetails: categoryStats
        },
        
        // 用户统计
        users: {
          total: allUsers.length,
          active: activeUsers.length,
          inactive: allUsers.length - activeUsers.length
        },
        
        // 系统状态
        system: {
          registration_enabled: registrationEnabled,
          maintenance_mode: maintenanceMode,
          max_users: maxUsers,
          database_type: 'SQLite',
          api_version: '1.0.0',
          node_version: process.version,
          uptime: Math.floor(process.uptime()),
          memory_usage: process.memoryUsage(),
          environment: process.env.NODE_ENV || 'development'
        }
      }
    });
  } catch (error) {
    console.error('Get system info error:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取系统信息失败',
      data: {
        images: { total: 0, landscape: 0, portrait: 0, categories: 0, local: 0, url: 0 },
        users: { total: 0, active: 0, inactive: 0 },
        system: { error: error.message }
      }
    });
  }
});

// 配置值验证函数
function validateConfigValue(key, value) {
  switch (key) {
    case 'registration_enabled':
    case 'registration_require_approval':
    case 'site_maintenance':
      if (value !== 'true' && value !== 'false') {
        return { valid: false, error: '布尔配置值必须是 "true" 或 "false"' };
      }
      break;
      
    case 'max_users':
      // 如果值为空或undefined，使用默认值1000
      if (!value || value === '') {
        return { valid: true, defaultValue: '1000' };
      }
      const num = parseInt(value);
      if (isNaN(num) || num < 1 || num > 100000) {
        return { valid: false, error: '用户数量限制必须是 1-100000 之间的数字' };
      }
      break;
      
    case 'registration_message':
      // 允许空消息
      if (!value || value === '') {
        return { valid: true, defaultValue: '欢迎注册 Random Image API！' };
      }
      if (typeof value !== 'string' || value.length > 500) {
        return { valid: false, error: '注册消息必须是不超过500字符的字符串' };
      }
      break;
      
    default:
      // 对于未知配置项，进行基本验证
      if (value && (typeof value !== 'string' || value.length > 1000)) {
        return { valid: false, error: '配置值必须是不超过1000字符的字符串' };
      }
  }
  
  return { valid: true };
}

module.exports = router;