const express = require('express');
const { authenticateSession } = require('../middleware/auth');

const router = express.Router();

// 中间件：只允许管理员访问
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 获取被限制的IP列表
router.get('/blocked-ips', authenticateSession, requireAdmin, (req, res) => {
  try {
    if (!global.securityMiddleware) {
      return res.status(500).json({ error: '安全中间件不可用' });
    }
    
    const blockedData = global.securityMiddleware.getBlockedIPs();
    res.json({
      success: true,
      data: blockedData,
      message: `当前有 ${blockedData.blocked.length} 个被封禁IP，${blockedData.suspicious.length} 个可疑IP`
    });
  } catch (error) {
    console.error('Get blocked IPs error:', error);
    res.status(500).json({ error: '获取IP列表失败' });
  }
});

// 清除所有IP限制
router.post('/clear-ip-restrictions', authenticateSession, requireAdmin, (req, res) => {
  try {
    if (!global.securityMiddleware) {
      return res.status(500).json({ error: '安全中间件不可用' });
    }
    
    const result = global.securityMiddleware.clearAllRestrictions();
    res.json({
      success: true,
      data: result,
      message: `已清除 ${result.clearedBlocked} 个被封禁IP和 ${result.clearedSuspicious} 个可疑IP`
    });
  } catch (error) {
    console.error('Clear IP restrictions error:', error);
    res.status(500).json({ error: '清除IP限制失败' });
  }
});

// 清除特定IP的限制
router.delete('/blocked-ips/:ip', authenticateSession, requireAdmin, (req, res) => {
  try {
    if (!global.securityMiddleware) {
      return res.status(500).json({ error: '安全中间件不可用' });
    }
    
    const { ip } = req.params;
    const result = global.securityMiddleware.clearIPRestriction(ip);
    res.json({
      success: true,
      data: result,
      message: `IP ${ip} 的限制已清除`
    });
  } catch (error) {
    console.error('Clear IP restriction error:', error);
    res.status(500).json({ error: '清除IP限制失败' });
  }
});

// 手动封禁IP
router.post('/block-ip', authenticateSession, requireAdmin, (req, res) => {
  try {
    if (!global.securityMiddleware) {
      return res.status(500).json({ error: '安全中间件不可用' });
    }
    
    const { ip, reason = '管理员手动封禁' } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: '请提供IP地址' });
    }
    
    const result = global.securityMiddleware.blockIP(ip, reason);
    res.json({
      success: true,
      data: result,
      message: `IP ${ip} 已被封禁`
    });
  } catch (error) {
    console.error('Block IP error:', error);
    res.status(500).json({ error: '封禁IP失败' });
  }
});

// 检查IP状态
router.get('/ip-status/:ip', authenticateSession, requireAdmin, (req, res) => {
  try {
    if (!global.securityMiddleware) {
      return res.status(500).json({ error: '安全中间件不可用' });
    }
    
    const { ip } = req.params;
    const status = global.securityMiddleware.getIPStatus(ip);
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get IP status error:', error);
    res.status(500).json({ error: '获取IP状态失败' });
  }
});

// 紧急清除所有限制（无需认证，用于紧急情况）
router.post('/emergency-clear', (req, res) => {
  try {
    const { emergencyKey } = req.body;
    
    // 简单的紧急密钥验证
    if (emergencyKey !== 'emergency-clear-2024') {
      return res.status(401).json({ error: '紧急密钥无效' });
    }
    
    if (!global.securityMiddleware) {
      return res.status(500).json({ error: '安全中间件不可用' });
    }
    
    const result = global.securityMiddleware.clearAllRestrictions();
    console.log('🚨 紧急清除所有IP限制');
    
    res.json({
      success: true,
      data: result,
      message: '紧急清除完成'
    });
  } catch (error) {
    console.error('Emergency clear error:', error);
    res.status(500).json({ error: '紧急清除失败' });
  }
});

module.exports = router;