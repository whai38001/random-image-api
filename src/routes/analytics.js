const express = require('express');
const Database = require('../models/Database');
const AnalyticsMiddleware = require('../middleware/analytics');
const SecurityMiddleware = require('../middleware/security');
const { authenticateSession } = require('../middleware/auth');

const router = express.Router();
const db = new Database();
const analytics = new AnalyticsMiddleware();

// 需要从app.js传递securityMiddleware实例，这里先定义一个变量
let securityMiddleware = null;

// 设置security middleware实例的方法
router.setSecurityMiddleware = (instance) => {
  securityMiddleware = instance;
};

// 中间件：只允许管理员访问统计数据
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 获取概览统计
router.get('/overview', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const stats = await db.getApiStats(parseInt(days));
    
    // 计算总计
    const totals = stats.reduce((acc, day) => ({
      total_requests: acc.total_requests + (day.total_requests || 0),
      unique_ips: acc.unique_ips + (day.unique_ips || 0),
      successful_requests: acc.successful_requests + (day.successful_requests || 0),
      failed_requests: acc.failed_requests + (day.failed_requests || 0),
      avg_response_time: acc.avg_response_time + (day.avg_response_time || 0)
    }), {
      total_requests: 0,
      unique_ips: 0,
      successful_requests: 0,
      failed_requests: 0,
      avg_response_time: 0
    });

    // 计算平均响应时间
    if (stats.length > 0) {
      totals.avg_response_time = totals.avg_response_time / stats.length;
    }

    // 计算成功率
    const success_rate = totals.total_requests > 0 
      ? ((totals.successful_requests / totals.total_requests) * 100).toFixed(2)
      : 0;

    res.json({
      period: `${days} days`,
      daily_stats: stats,
      totals: {
        ...totals,
        success_rate: parseFloat(success_rate)
      }
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: '获取统计概览失败' });
  }
});

// 获取详细统计
router.get('/detailed', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: '请提供开始日期和结束日期' });
    }

    const stats = await db.getDetailedStats(start_date, end_date);
    res.json({
      period: { start_date, end_date },
      ...stats
    });
  } catch (error) {
    console.error('Get detailed stats error:', error);
    res.status(500).json({ error: '获取详细统计失败' });
  }
});

// 获取热门IP地址
router.get('/top-ips', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { days = 7, limit = 10 } = req.query;
    const topIPs = await db.getTopIPs(parseInt(days), parseInt(limit));
    
    res.json({
      period: `${days} days`,
      top_ips: topIPs
    });
  } catch (error) {
    console.error('Get top IPs error:', error);
    res.status(500).json({ error: '获取热门IP失败' });
  }
});

// 获取响应时间统计
router.get('/response-times', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const responseStats = await db.getResponseTimeStats(parseInt(days));
    
    res.json({
      period: `${days} days`,
      response_time_stats: responseStats
    });
  } catch (error) {
    console.error('Get response time stats error:', error);
    res.status(500).json({ error: '获取响应时间统计失败' });
  }
});

// 实时统计（当前在线等）
router.get('/realtime', authenticateSession, requireAdmin, async (req, res) => {
  try {
    // 获取最近5分钟的请求
    const recentRequests = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as requests_last_5min,
          COUNT(DISTINCT ip_address) as unique_ips_last_5min,
          AVG(response_time) as avg_response_time_last_5min
        FROM api_stats 
        WHERE created_at >= datetime('now', '-5 minutes')
      `;
      
      db.db.get(query, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // 获取最近1小时的趋势
    const hourlyTrend = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          strftime('%H:%M', created_at) as time_slot,
          COUNT(*) as requests,
          COUNT(DISTINCT ip_address) as unique_ips
        FROM api_stats 
        WHERE created_at >= datetime('now', '-1 hour')
        GROUP BY strftime('%H:%M', created_at)
        ORDER BY time_slot ASC
      `;
      
      db.db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      current_time: new Date().toISOString(),
      recent_activity: recentRequests,
      hourly_trend: hourlyTrend
    });
  } catch (error) {
    console.error('Get realtime stats error:', error);
    res.status(500).json({ error: '获取实时统计失败' });
  }
});

// 手动更新日统计
router.post('/update-daily', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { date } = req.body;
    const result = await analytics.updateDailyStatsTask(date);
    
    res.json({
      success: true,
      message: '日统计更新成功',
      data: result
    });
  } catch (error) {
    console.error('Update daily stats error:', error);
    res.status(500).json({ error: '更新日统计失败' });
  }
});

// 清理旧数据
router.post('/cleanup', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { retention_days = 90 } = req.body;
    const result = await analytics.cleanupOldData(parseInt(retention_days));
    
    res.json({
      success: true,
      message: `已清理 ${retention_days} 天前的数据`,
      data: result
    });
  } catch (error) {
    console.error('Cleanup old data error:', error);
    res.status(500).json({ error: '清理旧数据失败' });
  }
});

// 导出统计数据
router.get('/export', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: '请提供开始日期和结束日期' });
    }

    const stats = await db.getDetailedStats(start_date, end_date);
    
    if (format === 'csv') {
      // 生成CSV格式
      let csv = 'Date,Total Requests,Unique IPs,Success Rate,Avg Response Time\n';
      
      if (stats.daily_trend) {
        stats.daily_trend.forEach(day => {
          const successRate = day.requests > 0 ? ((day.requests - (day.failed_requests || 0)) / day.requests * 100).toFixed(2) : 0;
          csv += `${day.date},${day.requests},${day.unique_ips},${successRate}%,${day.avg_response_time || 0}ms\n`;
        });
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="api_stats_${start_date}_${end_date}.csv"`);
      res.send(csv);
    } else {
      // 默认JSON格式
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="api_stats_${start_date}_${end_date}.json"`);
      res.json(stats);
    }
  } catch (error) {
    console.error('Export stats error:', error);
    res.status(500).json({ error: '导出统计数据失败' });
  }
});

// 获取安全统计
router.get('/security', authenticateSession, requireAdmin, async (req, res) => {
  try {
    if (!securityMiddleware) {
      return res.status(500).json({ error: '安全中间件未初始化' });
    }

    const securityStats = await securityMiddleware.getSecurityStats();
    res.json(securityStats);
  } catch (error) {
    console.error('Get security stats error:', error);
    res.status(500).json({ error: '获取安全统计失败' });
  }
});

// 手动封禁IP
router.post('/security/block-ip', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { ip, duration = 3600000 } = req.body; // 默认1小时
    
    if (!ip) {
      return res.status(400).json({ error: '请提供要封禁的IP地址' });
    }

    if (!securityMiddleware) {
      return res.status(500).json({ error: '安全中间件未初始化' });
    }

    securityMiddleware.blockIP(ip, parseInt(duration));
    
    res.json({
      success: true,
      message: `IP ${ip} 已被封禁 ${Math.round(duration / 60000)} 分钟`,
      blocked_ip: ip,
      duration_minutes: Math.round(duration / 60000)
    });
  } catch (error) {
    console.error('Block IP error:', error);
    res.status(500).json({ error: '封禁IP失败' });
  }
});

// 解封IP
router.post('/security/unblock-ip', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: '请提供要解封的IP地址' });
    }

    if (!securityMiddleware) {
      return res.status(500).json({ error: '安全中间件未初始化' });
    }

    securityMiddleware.unblockIP(ip);
    
    res.json({
      success: true,
      message: `IP ${ip} 已被解封`,
      unblocked_ip: ip
    });
  } catch (error) {
    console.error('Unblock IP error:', error);
    res.status(500).json({ error: '解封IP失败' });
  }
});

// 清理可疑记录
router.post('/security/cleanup', authenticateSession, requireAdmin, async (req, res) => {
  try {
    if (!securityMiddleware) {
      return res.status(500).json({ error: '安全中间件未初始化' });
    }

    securityMiddleware.cleanupSuspiciousRecords();
    
    res.json({
      success: true,
      message: '已清理过期的可疑活动记录'
    });
  } catch (error) {
    console.error('Security cleanup error:', error);
    res.status(500).json({ error: '清理安全记录失败' });
  }
});

module.exports = router;