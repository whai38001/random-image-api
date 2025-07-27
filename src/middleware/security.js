const rateLimit = require('express-rate-limit');
const Database = require('../models/Database');

class SecurityMiddleware {
  constructor() {
    this.db = new Database();
    this.suspiciousIPs = new Map(); // 存储可疑IP及其行为计数
    this.blockedIPs = new Set(); // 临时封禁的IP列表
  }

  // 检测可疑活动
  detectSuspiciousActivity() {
    return (req, res, next) => {
      const clientIP = this.getClientIP(req);
      const suspicious = this.suspiciousIPs.get(clientIP) || { count: 0, lastActivity: Date.now() };
      
      // 检测异常行为模式
      const isSuspicious = this.checkSuspiciousPatterns(req, suspicious);
      
      if (isSuspicious) {
        suspicious.count++;
        suspicious.lastActivity = Date.now();
        this.suspiciousIPs.set(clientIP, suspicious);
        
        // 记录可疑活动
        this.logSuspiciousActivity(clientIP, req, suspicious.count);
        
        // 如果可疑活动次数过多，临时封禁
        if (suspicious.count >= 10) {
          this.blockedIPs.add(clientIP);
          console.warn(`🚫 IP ${clientIP} temporarily blocked due to suspicious activity`);
          
          // 1小时后自动解封
          setTimeout(() => {
            this.blockedIPs.delete(clientIP);
            this.suspiciousIPs.delete(clientIP);
            console.log(`✅ IP ${clientIP} unblocked after timeout`);
          }, 60 * 60 * 1000);
          
          return res.status(429).json({ 
            error: '检测到异常活动，您的IP已被临时限制访问' 
          });
        }
      }
      
      // 检查是否在封禁列表中
      if (this.blockedIPs.has(clientIP)) {
        return res.status(429).json({ 
          error: '您的IP已被临时限制访问，请稍后再试' 
        });
      }
      
      next();
    };
  }

  // 检测可疑模式
  checkSuspiciousPatterns(req, suspicious) {
    const patterns = [
      // 1. 短时间内大量不同端点请求
      this.checkRapidEndpointSwitching(req, suspicious),
      
      // 2. 异常User-Agent
      this.checkSuspiciousUserAgent(req),
      
      // 3. 可疑的查询参数
      this.checkSuspiciousParameters(req),
      
      // 4. 异常的请求头
      this.checkSuspiciousHeaders(req),
      
      // 5. 暴力破解模式
      this.checkBruteForcePattern(req)
    ];
    
    return patterns.some(pattern => pattern);
  }

  checkRapidEndpointSwitching(req, suspicious) {
    if (!suspicious.endpoints) {
      suspicious.endpoints = new Set();
    }
    
    suspicious.endpoints.add(req.path);
    
    // 短时间内访问超过20个不同端点
    return suspicious.endpoints.size > 20 && 
           (Date.now() - suspicious.lastActivity) < 60000; // 1分钟内
  }

  checkSuspiciousUserAgent(req) {
    const userAgent = req.headers['user-agent'] || '';
    const suspiciousPatterns = [
      /bot|crawler|spider|scraper/i,
      /wget|curl|python|java|php/i,
      /^$/,  // 空User-Agent
      /^\s*$/  // 只有空白字符
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  checkSuspiciousParameters(req) {
    const params = { ...req.query, ...req.body };
    const suspiciousPatterns = [
      // SQL注入模式
      /(\b(union|select|insert|update|delete|drop|create|alter)\b)/i,
      // XSS模式
      /<script|javascript:|on\w+\s*=/i,
      // 路径遍历
      /\.\./,
      // 命令注入
      /[;&|`$]/
    ];
    
    for (const value of Object.values(params)) {
      if (typeof value === 'string') {
        if (suspiciousPatterns.some(pattern => pattern.test(value))) {
          return true;
        }
      }
    }
    
    return false;
  }

  checkSuspiciousHeaders(req) {
    const headers = req.headers;
    
    // 检查异常的Referer
    if (headers.referer && headers.referer.includes('localhost') && req.hostname !== 'localhost') {
      return true;
    }
    
    // 检查缺少常见头部
    if (!headers['user-agent'] && !headers['accept']) {
      return true;
    }
    
    return false;
  }

  checkBruteForcePattern(req) {
    // 检查是否是认证相关的端点
    const authEndpoints = ['/auth/login', '/auth/register', '/auth/forgot-password'];
    return authEndpoints.includes(req.path) && req.method === 'POST';
  }

  // 获取客户端IP
  getClientIP(req) {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
  }

  // 记录可疑活动
  async logSuspiciousActivity(ip, req, count) {
    try {
      await this.db.recordApiRequest({
        endpoint: '/security/suspicious-activity',
        method: 'LOG',
        ip_address: ip,
        user_agent: req.headers['user-agent'],
        referer: req.headers['referer'],
        response_status: 999, // 特殊状态码表示安全事件
        response_time: 0,
        category: 'security',
        orientation: `suspicious_count_${count}`
      });
    } catch (error) {
      console.error('Failed to log suspicious activity:', error);
    }
  }

  // 创建动态限流器
  createDynamicLimiter(baseOptions) {
    return rateLimit({
      ...baseOptions,
      keyGenerator: (req) => {
        const ip = this.getClientIP(req);
        const suspicious = this.suspiciousIPs.get(ip);
        
        // 可疑IP使用更严格的key
        if (suspicious && suspicious.count > 5) {
          return `suspicious_${ip}`;
        }
        
        return req.session?.userId ? `user_${req.session.userId}` : ip;
      },
      max: (req) => {
        const ip = this.getClientIP(req);
        const suspicious = this.suspiciousIPs.get(ip);
        
        // 可疑IP的限制更严格
        if (suspicious && suspicious.count > 5) {
          return Math.max(1, Math.floor(baseOptions.max / suspicious.count));
        }
        
        return baseOptions.max;
      }
    });
  }

  // 获取安全统计
  async getSecurityStats() {
    try {
      const stats = {
        currently_blocked_ips: Array.from(this.blockedIPs),
        suspicious_ips: Array.from(this.suspiciousIPs.entries()).map(([ip, data]) => ({
          ip,
          count: data.count,
          last_activity: new Date(data.lastActivity),
          endpoints: data.endpoints ? Array.from(data.endpoints) : []
        })),
        total_blocked: this.blockedIPs.size,
        total_suspicious: this.suspiciousIPs.size
      };
      
      return stats;
    } catch (error) {
      console.error('Get security stats error:', error);
      throw error;
    }
  }

  // 手动封禁IP
  blockIP(ip, duration = 3600000) { // 默认1小时
    this.blockedIPs.add(ip);
    console.warn(`🚫 IP ${ip} manually blocked`);
    
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      console.log(`✅ IP ${ip} unblocked after manual timeout`);
    }, duration);
  }

  // 解封IP
  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
    console.log(`✅ IP ${ip} manually unblocked`);
  }

  // 清理过期的可疑记录
  cleanupSuspiciousRecords() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (now - data.lastActivity > maxAge) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }

  // 清除所有IP限制（管理员功能）
  clearAllRestrictions() {
    const blockedCount = this.blockedIPs.size;
    const suspiciousCount = this.suspiciousIPs.size;
    
    this.blockedIPs.clear();
    this.suspiciousIPs.clear();
    
    console.log(`🧹 清除了 ${blockedCount} 个被封禁IP和 ${suspiciousCount} 个可疑IP记录`);
    
    return {
      clearedBlocked: blockedCount,
      clearedSuspicious: suspiciousCount,
      timestamp: new Date().toISOString()
    };
  }

  // 清除特定IP的限制
  clearIPRestriction(ip) {
    const wasBlocked = this.blockedIPs.has(ip);
    const wasSuspicious = this.suspiciousIPs.has(ip);
    
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
    
    console.log(`🔓 IP ${ip} 的限制已清除 (被封禁: ${wasBlocked}, 可疑: ${wasSuspicious})`);
    
    return {
      ip,
      wasBlocked,
      wasSuspicious,
      timestamp: new Date().toISOString()
    };
  }

  // 获取所有被限制的IP
  getBlockedIPs() {
    return {
      blocked: Array.from(this.blockedIPs),
      suspicious: Array.from(this.suspiciousIPs.entries()).map(([ip, data]) => ({
        ip,
        count: data.count,
        lastActivity: new Date(data.lastActivity).toISOString()
      }))
    };
  }

  // 手动添加IP到黑名单
  manualBlockIP(ip, reason = 'Manual block') {
    this.blockedIPs.add(ip);
    console.log(`🚫 手动封禁IP: ${ip}, 原因: ${reason}`);
    
    return {
      ip,
      reason,
      timestamp: new Date().toISOString()
    };
  }

  // 检查IP状态
  getIPStatus(ip) {
    const isBlocked = this.blockedIPs.has(ip);
    const suspicious = this.suspiciousIPs.get(ip);
    
    return {
      ip,
      isBlocked,
      suspicious: suspicious ? {
        count: suspicious.count,
        lastActivity: new Date(suspicious.lastActivity).toISOString()
      } : null
    };
  }
}

module.exports = SecurityMiddleware;