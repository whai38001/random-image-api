const logger = require('../utils/logger');

/**
 * 性能监控中间件
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: new Map(),
      averageResponseTime: 0,
      totalRequests: 0,
      errorRate: 0,
      activeConnections: 0
    };
    
    this.slowQueryThreshold = 1000; // 1秒
    this.slowRequestThreshold = 5000; // 5秒
    
    // 定期清理旧数据
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000); // 每分钟清理一次
  }

  /**
   * HTTP请求性能监控中间件
   */
  trackRequest() {
    return (req, res, next) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      this.metrics.activeConnections++;
      
      // 响应完成时记录指标
      res.on('finish', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const endMemory = process.memoryUsage();
        
        this.metrics.activeConnections--;
        this.metrics.totalRequests++;
        
        // 计算平均响应时间
        this.updateAverageResponseTime(responseTime);
        
        // 更新错误率
        this.updateErrorRate(res.statusCode);
        
        // 记录访问日志
        logger.apiAccess(req, res, responseTime);
        
        // 记录慢请求
        if (responseTime > this.slowRequestThreshold) {
          logger.performance('Slow request detected', {
            url: req.url,
            method: req.method,
            responseTime,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        }
        
        // 存储详细指标
        this.storeRequestMetrics(req, res, {
          responseTime,
          memoryUsage: {
            before: startMemory,
            after: endMemory,
            delta: {
              rss: endMemory.rss - startMemory.rss,
              heapUsed: endMemory.heapUsed - startMemory.heapUsed
            }
          }
        });
      });
      
      next();
    };
  }

  /**
   * 数据库查询性能监控
   */
  trackDbQuery(query, params = []) {
    const startTime = Date.now();
    
    return {
      end: (rowCount = null) => {
        const duration = Date.now() - startTime;
        logger.databaseQuery(query, duration, rowCount);
        
        if (duration > this.slowQueryThreshold) {
          logger.warn('Slow database query', {
            query: query.substring(0, 200),
            params: JSON.stringify(params).substring(0, 100),
            duration,
            rowCount
          });
        }
        
        return { duration, rowCount };
      }
    };
  }

  /**
   * 文件上传性能监控
   */
  trackFileUpload(filename, fileSize) {
    const startTime = Date.now();
    
    return {
      end: (userId = null) => {
        const uploadTime = Date.now() - startTime;
        logger.fileUpload(filename, fileSize, uploadTime, userId);
        
        // 计算上传速度
        const speedMBps = (fileSize / 1024 / 1024) / (uploadTime / 1000);
        
        if (uploadTime > 30000) { // 超过30秒的上传
          logger.performance('Slow file upload', {
            filename,
            fileSize,
            uploadTime,
            speedMBps,
            userId
          });
        }
        
        return { uploadTime, speedMBps };
      }
    };
  }

  /**
   * 系统资源监控
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: Math.round(process.uptime()),
      activeConnections: this.metrics.activeConnections,
      totalRequests: this.metrics.totalRequests,
      averageResponseTime: this.metrics.averageResponseTime,
      errorRate: this.metrics.errorRate
    };
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    const now = Date.now();
    const last5min = now - 5 * 60 * 1000;
    const last1hour = now - 60 * 60 * 1000;
    
    const recent5min = Array.from(this.metrics.requests.values())
      .filter(req => req.timestamp > last5min);
    
    const recent1hour = Array.from(this.metrics.requests.values())
      .filter(req => req.timestamp > last1hour);
    
    return {
      system: this.getSystemMetrics(),
      requests: {
        last5minutes: {
          count: recent5min.length,
          averageResponseTime: this.calculateAverage(recent5min, 'responseTime'),
          errorCount: recent5min.filter(req => req.statusCode >= 400).length
        },
        last1hour: {
          count: recent1hour.length,
          averageResponseTime: this.calculateAverage(recent1hour, 'responseTime'),
          errorCount: recent1hour.filter(req => req.statusCode >= 400).length
        }
      },
      topEndpoints: this.getTopEndpoints(recent1hour),
      slowestRequests: this.getSlowestRequests(recent1hour, 10)
    };
  }

  /**
   * 健康检查
   */
  healthCheck() {
    const metrics = this.getSystemMetrics();
    const issues = [];
    
    // 内存使用率检查
    if (metrics.memory.heapUsed > 500) { // 500MB
      issues.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${metrics.memory.heapUsed}MB`
      });
    }
    
    // 响应时间检查
    if (metrics.averageResponseTime > 2000) { // 2秒
      issues.push({
        type: 'performance',
        severity: 'warning',
        message: `High average response time: ${metrics.averageResponseTime}ms`
      });
    }
    
    // 错误率检查
    if (metrics.errorRate > 0.05) { // 5%
      issues.push({
        type: 'errors',
        severity: metrics.errorRate > 0.1 ? 'critical' : 'warning',
        message: `High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`
      });
    }
    
    // 活跃连接数检查
    if (metrics.activeConnections > 100) {
      issues.push({
        type: 'connections',
        severity: 'warning',
        message: `High number of active connections: ${metrics.activeConnections}`
      });
    }
    
    return {
      status: issues.length === 0 ? 'healthy' : 'warning',
      issues,
      metrics,
      timestamp: new Date().toISOString()
    };
  }

  // 私有方法
  updateAverageResponseTime(responseTime) {
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) 
      / this.metrics.totalRequests;
  }

  updateErrorRate(statusCode) {
    const errorCount = Array.from(this.metrics.requests.values())
      .filter(req => req.statusCode >= 400).length;
    
    this.metrics.errorRate = errorCount / this.metrics.totalRequests;
  }

  storeRequestMetrics(req, res, metrics) {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.metrics.requests.set(requestId, {
      timestamp: Date.now(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: metrics.responseTime,
      memoryUsage: metrics.memoryUsage,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }

  cleanupOldMetrics() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24小时前
    
    for (const [key, value] of this.metrics.requests.entries()) {
      if (value.timestamp < cutoff) {
        this.metrics.requests.delete(key);
      }
    }
  }

  calculateAverage(arr, field) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, item) => sum + item[field], 0) / arr.length;
  }

  getTopEndpoints(requests, limit = 10) {
    const endpointCounts = {};
    
    requests.forEach(req => {
      const endpoint = `${req.method} ${req.url.split('?')[0]}`;
      if (!endpointCounts[endpoint]) {
        endpointCounts[endpoint] = { count: 0, totalTime: 0 };
      }
      endpointCounts[endpoint].count++;
      endpointCounts[endpoint].totalTime += req.responseTime;
    });
    
    return Object.entries(endpointCounts)
      .map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        averageTime: Math.round(data.totalTime / data.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getSlowestRequests(requests, limit = 10) {
    return requests
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, limit)
      .map(req => ({
        url: req.url,
        method: req.method,
        responseTime: req.responseTime,
        statusCode: req.statusCode,
        timestamp: new Date(req.timestamp).toISOString()
      }));
  }
}

module.exports = new PerformanceMonitor();