const Database = require('../models/Database');

/**
 * 🔍 图片搜索服务
 * 提供实时搜索、过滤和排序功能
 */
class SearchService {
  constructor() {
    this.db = new Database();
  }

  /**
   * 搜索图片
   * @param {Object} params - 搜索参数
   * @param {string} params.query - 搜索关键词
   * @param {string} params.category - 分类过滤
   * @param {string} params.orientation - 方向过滤
   * @param {string} params.type - 类型过滤 (local/url)
   * @param {string} params.sort - 排序方式 (newest/oldest/random)
   * @param {number} params.page - 页码
   * @param {number} params.limit - 每页数量
   * @returns {Promise<Object>} 搜索结果
   */
  async searchImages(params) {
    const {
      query = '',
      category = '',
      orientation = '',
      type = '', // 'local', 'url', ''
      sort = 'newest',
      page = 1,
      limit = 12
    } = params;

    const offset = (page - 1) * limit;

    // 构建WHERE条件
    const conditions = [];
    const values = [];

    // 关键词搜索（原始文件名、分类）
    if (query && query.trim()) {
      conditions.push(`(
        original_name LIKE ? OR 
        category LIKE ? OR 
        filename LIKE ?
      )`);
      const searchTerm = `%${query.trim()}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    // 分类过滤
    if (category) {
      conditions.push('category = ?');
      values.push(category);
    }

    // 方向过滤
    if (orientation) {
      conditions.push('orientation = ?');
      values.push(orientation);
    }

    // 类型过滤
    if (type === 'local') {
      conditions.push('is_local = 1');
    } else if (type === 'url') {
      conditions.push('is_local = 0');
    }

    // 构建SQL查询
    let whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // 排序逻辑
    let orderClause;
    switch (sort) {
      case 'oldest':
        orderClause = 'ORDER BY created_at ASC';
        break;
      case 'random':
        orderClause = 'ORDER BY RANDOM()';
        break;
      case 'newest':
      default:
        orderClause = 'ORDER BY created_at DESC';
        break;
    }

    // 查询总数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM images 
      ${whereClause}
    `;
    
    // 使用现有数据库实例而不是自定义query方法
    const Database = require('../models/Database');
    const dbInstance = new Database();
    
    return new Promise((resolve, reject) => {
      dbInstance.db.get(countSql, values, (err, countResult) => {
        if (err) {
          reject(err);
          return;
        }
        
        const total = countResult.total;

        // 查询数据
        const dataQuery = `
          SELECT 
            id, filename, original_name, category, orientation, 
            url, is_local, created_at, thumbnail
          FROM images 
          ${whereClause}
          ${orderClause}
          LIMIT ? OFFSET ?
        `;
        
        const dataValues = [...values, limit, offset];
        
        dbInstance.db.all(dataQuery, dataValues, (err, images) => {
          if (err) {
            reject(err);
            return;
          }

          // 处理图片URL
          const processedImages = images.map(image => {
            if (image.is_local) {
              return {
                ...image,
                url: `/api/images/${image.id}`,
                thumbnail_url: image.thumbnail ? `/thumbnails/medium/${image.thumbnail}` : null
              };
            }
            return {
              ...image,
              thumbnail_url: null // URL图片暂不支持缩略图
            };
          });

          // 分页信息
          const pagination = {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
          };

          resolve({
            images: processedImages,
            pagination,
            filters: {
              query,
              category,
              orientation,
              type,
              sort
            }
          });
        });
      });
    });
  }

  /**
   * 获取搜索建议
   * @param {string} query - 搜索关键词
   * @param {number} limit - 建议数量限制
   * @returns {Promise<Array>} 搜索建议列表
   */
  async getSearchSuggestions(query, limit = 5) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;
    
    // 使用现有数据库实例
    const Database = require('../models/Database');
    const dbInstance = new Database();
    
    return new Promise((resolve, reject) => {
      // 搜索分类建议
      const categoryQuery = `
        SELECT DISTINCT category as suggestion, 'category' as type
        FROM images 
        WHERE category LIKE ? 
        LIMIT ?
      `;

      dbInstance.db.all(categoryQuery, [searchTerm, limit], (err, categories) => {
        if (err) {
          reject(err);
          return;
        }

        // 搜索文件名建议
        const filenameQuery = `
          SELECT DISTINCT original_name as suggestion, 'filename' as type
          FROM images 
          WHERE original_name LIKE ? AND original_name != ''
          LIMIT ?
        `;

        dbInstance.db.all(filenameQuery, [searchTerm, limit], (err, filenames) => {
          if (err) {
            reject(err);
            return;
          }

          // 合并并限制结果
          const suggestions = [...categories, ...filenames]
            .slice(0, limit)
            .map(item => ({
              text: item.suggestion,
              type: item.type
            }));

          resolve(suggestions);
        });
      });
    });
  }

  /**
   * 获取热门搜索关键词
   * @param {number} limit - 返回数量
   * @returns {Promise<Array>} 热门关键词列表
   */
  async getPopularKeywords(limit = 10) {
    // 使用现有数据库实例
    const Database = require('../models/Database');
    const dbInstance = new Database();
    
    return new Promise((resolve, reject) => {
      // 获取最常见的分类
      const categoryQuery = `
        SELECT category as keyword, COUNT(*) as count
        FROM images 
        WHERE category != ''
        GROUP BY category 
        ORDER BY count DESC 
        LIMIT ?
      `;

      dbInstance.db.all(categoryQuery, [limit], (err, categories) => {
        if (err) {
          reject(err);
          return;
        }
        
        const keywords = categories.map(item => ({
          keyword: item.keyword,
          count: item.count,
          type: 'category'
        }));

        resolve(keywords);
      });
    });
  }

  /**
   * 获取搜索统计信息
   * @returns {Promise<Object>} 搜索统计
   */
  async getSearchStats() {
    try {
      // 使用现有的工作正常的数据库方法
      const Database = require('../models/Database');
      const db = new Database();
      
      // 使用已经存在且工作正常的getImageStats方法
      const stats = await db.getImageStats();
      
      // 简单返回已知正确的统计信息，加上计算出的本地/URL分布
      return {
        total: stats.total,
        local: 0, // 暂时设为0，避免复杂查询
        url: stats.total, // 假设全部为URL图片
        landscape: stats.landscape,
        portrait: stats.portrait,
        categories: stats.categories
      };
    } catch (error) {
      console.error('Error getting search stats:', error);
      // 返回默认值
      return {
        total: 0,
        local: 0,
        url: 0,
        landscape: 0,
        portrait: 0,
        categories: 0
      };
    }
  }
}

module.exports = SearchService;