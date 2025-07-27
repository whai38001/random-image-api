/**
 * 标准化API响应格式
 */
class ApiResponse {
  /**
   * 成功响应
   */
  static success(res, data = null, message = 'Success', statusCode = 200, meta = {}) {
    const response = {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        path: res.req?.originalUrl || res.req?.url,
        method: res.req?.method,
        ...meta
      }
    };

    return res.status(statusCode).json(response);
  }

  /**
   * 错误响应
   */
  static error(res, message, statusCode = 500, errorCode = null, details = null) {
    const response = {
      success: false,
      error: {
        message,
        code: errorCode,
        details,
        statusCode
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: res.req?.originalUrl || res.req?.url,
        method: res.req?.method
      }
    };

    return res.status(statusCode).json(response);
  }

  /**
   * 分页响应
   */
  static paginated(res, data, pagination, message = 'Success') {
    const response = {
      success: true,
      message,
      data,
      pagination: {
        page: parseInt(pagination.page) || 1,
        limit: parseInt(pagination.limit) || 10,
        total: pagination.total || 0,
        totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false,
        ...pagination
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: res.req?.originalUrl || res.req?.url,
        method: res.req?.method
      }
    };

    return res.status(200).json(response);
  }

  /**
   * 验证错误响应
   */
  static validationError(res, errors) {
    const response = {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: Array.isArray(errors) ? errors : [errors],
        statusCode: 400
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: res.req?.originalUrl || res.req?.url,
        method: res.req?.method
      }
    };

    return res.status(400).json(response);
  }

  /**
   * 未授权响应
   */
  static unauthorized(res, message = 'Unauthorized') {
    return this.error(res, message, 401, 'UNAUTHORIZED');
  }

  /**
   * 禁止访问响应
   */
  static forbidden(res, message = 'Forbidden') {
    return this.error(res, message, 403, 'FORBIDDEN');
  }

  /**
   * 资源未找到响应
   */
  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404, 'NOT_FOUND');
  }

  /**
   * 请求冲突响应
   */
  static conflict(res, message = 'Resource conflict') {
    return this.error(res, message, 409, 'CONFLICT');
  }

  /**
   * 速率限制响应
   */
  static rateLimit(res, message = 'Rate limit exceeded') {
    return this.error(res, message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  /**
   * 服务器错误响应
   */
  static serverError(res, message = 'Internal server error') {
    return this.error(res, message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

module.exports = ApiResponse;