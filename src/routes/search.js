const express = require('express');
const SearchService = require('../services/SearchService');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, ValidationError } = require('../utils/errorHandler');

const router = express.Router();
const searchService = new SearchService();

/**
 * 🔍 图片搜索 API
 * GET /api/search?query=keyword&category=nature&orientation=landscape&type=local&sort=newest&page=1&limit=12
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    query = '',
    category = '',
    orientation = '',
    type = '',
    sort = 'newest',
    page = 1,
    limit = 12
  } = req.query;

  // 参数验证
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (pageNum < 1) {
    throw new ValidationError('页码必须大于0');
  }

  if (limitNum < 1 || limitNum > 50) {
    throw new ValidationError('每页数量必须在1-50之间');
  }

  if (sort && !['newest', 'oldest', 'random'].includes(sort)) {
    throw new ValidationError('无效的排序方式');
  }

  if (type && !['local', 'url'].includes(type)) {
    throw new ValidationError('无效的图片类型');
  }

  if (orientation && !['landscape', 'portrait'].includes(orientation)) {
    throw new ValidationError('无效的图片方向');
  }

  // 执行搜索
  const result = await searchService.searchImages({
    query: query.trim(),
    category,
    orientation,
    type,
    sort,
    page: pageNum,
    limit: limitNum
  });

  return ApiResponse.paginated(
    res,
    result.images,
    result.pagination,
    '搜索完成',
    200,
    { 
      filters: result.filters,
      searchStats: {
        totalFound: result.pagination.total,
        searchTime: Date.now() // 可以记录实际搜索时间
      }
    }
  );
}));

/**
 * 🔮 搜索建议 API
 * GET /api/search/suggestions?q=keyword&limit=5
 */
router.get('/suggestions', asyncHandler(async (req, res) => {
  const { q: query = '', limit = 5 } = req.query;
  
  const limitNum = parseInt(limit);
  if (limitNum < 1 || limitNum > 20) {
    throw new ValidationError('建议数量必须在1-20之间');
  }

  if (query.length < 2) {
    return ApiResponse.success(res, [], '搜索关键词太短');
  }

  const suggestions = await searchService.getSearchSuggestions(query.trim(), limitNum);
  
  return ApiResponse.success(res, suggestions, '获取搜索建议成功');
}));

/**
 * 🔥 热门关键词 API
 * GET /api/search/popular?limit=10
 */
router.get('/popular', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const limitNum = parseInt(limit);
  if (limitNum < 1 || limitNum > 50) {
    throw new ValidationError('关键词数量必须在1-50之间');
  }

  const keywords = await searchService.getPopularKeywords(limitNum);
  
  return ApiResponse.success(res, keywords, '获取热门关键词成功');
}));

/**
 * 📊 搜索统计 API
 * GET /api/search/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await searchService.getSearchStats();
  
  return ApiResponse.success(res, stats, '获取搜索统计成功');
}));

/**
 * 🏷️ 获取所有分类 API
 * GET /api/search/categories
 */
router.get('/categories', asyncHandler(async (req, res) => {
  const query = `
    SELECT category, COUNT(*) as count
    FROM images 
    WHERE category != ''
    GROUP BY category 
    ORDER BY count DESC
  `;
  
  const categories = await searchService.db.query(query);
  
  return ApiResponse.success(res, categories, '获取分类列表成功');
}));

/**
 * 🔄 快速过滤 API
 * GET /api/search/filter?type=local&orientation=landscape
 */
router.get('/filter', asyncHandler(async (req, res) => {
  const { type, orientation, category, page = 1, limit = 12 } = req.query;
  
  // 构建过滤参数
  const filterParams = {
    query: '',
    page: parseInt(page),
    limit: parseInt(limit)
  };
  
  if (type) filterParams.type = type;
  if (orientation) filterParams.orientation = orientation;
  if (category) filterParams.category = category;
  
  const result = await searchService.searchImages(filterParams);
  
  return ApiResponse.paginated(
    res,
    result.images,
    result.pagination,
    '过滤完成',
    200,
    { filters: result.filters }
  );
}));

module.exports = router;