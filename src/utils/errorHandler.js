const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 验证错误类
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * 授权错误类
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * 权限错误类
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * 资源未找到错误类
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 冲突错误类
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 速率限制错误类
 */
class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误日志
  logger.error('Error caught by global handler', {
    error: error.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.session?.userId || null
  });

  // 开发环境显示详细错误信息
  if (process.env.NODE_ENV === 'development') {
    console.error('🔥 Error Stack:', err.stack);
  }

  // 处理特定错误类型
  if (err.name === 'ValidationError') {
    const validationErrors = Object.values(err.errors).map(val => val.message);
    return ApiResponse.validationError(res, validationErrors);
  }

  // 处理MongoDB/SQLite错误
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 11000) {
    return ApiResponse.conflict(res, '资源已存在');
  }

  // 处理JWT错误
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.unauthorized(res, '无效的令牌');
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.unauthorized(res, '令牌已过期');
  }

  // 处理Multer文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return ApiResponse.error(res, '文件大小超出限制', 400, 'FILE_TOO_LARGE');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return ApiResponse.error(res, '意外的文件字段', 400, 'UNEXPECTED_FILE');
  }

  // 处理自定义应用错误
  if (err.isOperational) {
    return ApiResponse.error(res, err.message, err.statusCode, err.errorCode, err.details);
  }

  // 处理系统错误
  if (process.env.NODE_ENV === 'production') {
    // 生产环境不暴露系统错误详情
    return ApiResponse.serverError(res, '服务器内部错误');
  } else {
    // 开发环境返回详细错误信息
    return ApiResponse.error(res, err.message, 500, 'INTERNAL_ERROR', {
      stack: err.stack
    });
  }
};

/**
 * 处理未找到的路由
 */
const notFoundHandler = (req, res, next) => {
  return ApiResponse.notFound(res, `路由 ${req.originalUrl} 不存在`);
};

/**
 * 异步错误处理包装器
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 验证中间件
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return ApiResponse.validationError(res, validationErrors);
    }
    
    next();
  };
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validate
};