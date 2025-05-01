/**
 * @fileoverview 全局错误处理服务
 * 提供统一的错误处理机制，包括未捕获异常、Express错误等
 */
import logger from '../utils/logger.js';

/**
 * 错误处理服务类
 */
class ErrorHandlerService {
  /**
   * 创建Express错误处理中间件
   * @returns {Function} Express错误处理中间件
   */
  createExpressErrorHandler() {
    return (err, req, res, next) => {
      // 记录错误
      this.logError(err, req);

      // 获取错误状态码，默认500
      const statusCode = err.status || err.statusCode || 500;

      // 判断是否为生产环境
      const isProd = process.env.NODE_ENV === 'production';

      // 构造错误响应
      const errorResponse = {
        status: 'error',
        code: err.code || 'server_error',
        message: err.message || '服务器内部错误'
      };

      // 在非生产环境下，添加详细错误信息
      if (!isProd) {
        errorResponse.stack = err.stack;
        errorResponse.details = err.details || null;
      }

      // 发送错误响应
      res.status(statusCode).json(errorResponse);
    };
  }

  /**
   * 注册全局未捕获异常处理器
   */
  registerGlobalHandlers() {
    // 处理未捕获的Promise异常
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未捕获的Promise异常:', reason);
    });

    // 处理未捕获的同步异常
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常:', error);

      // 如果是严重错误，可能需要优雅退出
      if (this.isFatalError(error)) {
        logger.error('检测到严重错误，应用将在1秒后退出');

        // 延迟退出，给日志写入时间
        setTimeout(() => {
          process.exit(1);
        }, 1000);
      }
    });

    logger.info('全局错误处理器已注册');
  }

  /**
   * 判断是否为致命错误
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为致命错误
   */
  isFatalError(error) {
    // 这些类型的错误通常表明程序状态已不可靠
    const fatalErrorTypes = [
      'EvalError',
      'RangeError',
      'ReferenceError',
      'SyntaxError',
      'URIError'
    ];

    // 一些系统错误也可能是致命的
    const fatalSystemErrors = [
      'EADDRINUSE',   // 端口被占用
      'ECONNREFUSED', // 连接被拒绝
      'EACCES',       // 权限拒绝
      'ENOENT',       // 找不到文件
      'ESOCKETTIMEDOUT' // 套接字超时
    ];

    return (
      fatalErrorTypes.includes(error.name) ||
      (error.code && fatalSystemErrors.includes(error.code))
    );
  }

  /**
   * 记录错误信息
   * @param {Error} error - 错误对象
   * @param {Object} req - Express请求对象
   */
  logError(error, req = null) {
    // 构建基本错误信息
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    };

    // 如果有请求对象，添加请求信息
    if (req) {
      errorInfo.request = {
        method: req.method,
        url: req.originalUrl || req.url,
        headers: this.sanitizeHeaders(req.headers),
        ip: req.ip || req.connection.remoteAddress
      };
    }

    // 记录详细错误日志
    logger.error('应用错误:', errorInfo);
  }

  /**
   * 清理请求头中的敏感信息
   * @param {Object} headers - 请求头对象
   * @returns {Object} 清理后的请求头
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };

    // 移除敏感信息
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key'
    ];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

// 创建单例
const errorHandlerService = new ErrorHandlerService();

export default errorHandlerService;