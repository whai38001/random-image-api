const Database = require('../models/Database');

class AnalyticsMiddleware {
  constructor() {
    this.db = new Database();
  }

  // 记录API请求的中间件
  trackRequest() {
    return async (req, res, next) => {
      const startTime = Date.now();
      
      // 获取客户端IP
      const getClientIP = (req) => {
        return req.headers['x-forwarded-for'] ||
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
      };

      // 记录请求信息
      const requestData = {
        endpoint: req.path,
        method: req.method,
        ip_address: getClientIP(req),
        user_agent: req.headers['user-agent'],
        referer: req.headers['referer'] || req.headers['referrer'],
        query_params: JSON.stringify(req.query)
      };

      // 修改res.json来捕获响应
      const originalJson = res.json;
      res.json = function(data) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // 完善请求数据
        requestData.response_status = res.statusCode;
        requestData.response_time = responseTime;
        
        // 如果是图片API请求，记录图片信息
        if (req.path.includes('/api/random') && data && data.id) {
          requestData.image_id = data.id;
          requestData.category = data.category;
          requestData.orientation = data.orientation;
        }
        
        // 异步记录到数据库（不阻塞响应）
        setImmediate(async () => {
          try {
            await req.analyticsMiddleware.db.recordApiRequest(requestData);
            
            // 每100次请求更新一次日统计（减少数据库负载）
            if (Math.random() < 0.01) { // 1%的概率
              await req.analyticsMiddleware.db.updateDailyStats();
            }
          } catch (error) {
            console.error('Analytics recording error:', error);
          }
        });
        
        // 调用原始的json方法
        return originalJson.call(this, data);
      };

      // 将middleware实例附加到request对象
      req.analyticsMiddleware = this;
      
      next();
    };
  }

  // 每日统计更新任务（可以由定时任务调用）
  async updateDailyStatsTask() {
    try {
      const result = await this.db.updateDailyStats();
      console.log('Daily stats updated:', result);
      return result;
    } catch (error) {
      console.error('Update daily stats error:', error);
      throw error;
    }
  }

  // 清理旧数据（保留指定天数的数据）
  async cleanupOldData(retentionDays = 90) {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      const queries = [
        `DELETE FROM api_stats WHERE DATE(created_at) < '${cutoffDateStr}'`,
        `DELETE FROM daily_stats WHERE date < '${cutoffDateStr}'`
      ];
      
      let completed = 0;
      const results = {};
      
      queries.forEach((query, index) => {
        this.db.db.run(query, function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          results[index] = { changes: this.changes };
          completed++;
          
          if (completed === queries.length) {
            console.log(`Cleaned up data older than ${retentionDays} days:`, results);
            resolve(results);
          }
        });
      });
    });
  }
}

module.exports = AnalyticsMiddleware;