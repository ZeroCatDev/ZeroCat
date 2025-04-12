import logger from '../utils/logger.js';

/**
 * 错误处理服务 - 负责应用中的全局错误处理和监控
 */
class ErrorHandlerService {
  /**
   * 注册进程级别的错误处理器
   */
  registerGlobalHandlers() {
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      this.handleUncaughtException(error);
    });

    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      this.handleUnhandledRejection(reason, promise);
    });

    // 处理进程警告
    process.on('warning', (warning) => {
      this.handleProcessWarning(warning);
    });

    logger.info('全局错误处理器已注册');
  }

  /**
   * 处理未捕获的异常
   * @param {Error} error 未捕获的异常
   */
  handleUncaughtException(error) {
    logger.error('未捕获的异常:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // 记录错误后继续运行，除非是致命错误
    if (this.isFatalError(error)) {
      logger.fatal('检测到致命错误，应用将在5秒后退出');
      // 给日志一些时间写入
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    }
  }

  /**
   * 处理未处理的Promise拒绝
   * @param {*} reason 拒绝原因
   * @param {Promise} promise 被拒绝的Promise
   */
  handleUnhandledRejection(reason, promise) {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    logger.error('未处理的Promise拒绝:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }

  /**
   * 处理进程警告
   * @param {Error} warning 警告对象
   */
  handleProcessWarning(warning) {
    logger.warn('进程警告:', {
      message: warning.message,
      name: warning.name,
      stack: warning.stack
    });
  }

  /**
   * 判断错误是否是致命错误
   * @param {Error} error 错误对象
   * @returns {boolean} 是否为致命错误
   */
  isFatalError(error) {
    // 这里可以根据实际需求定义哪些错误是致命的
    const fatalErrorTypes = [
      'EvalError',
      'InternalError',
      'RangeError',
      'ReferenceError',
      'SyntaxError',
      'TypeError',
      'URIError'
    ];

    // 检查是否是系统级错误
    if (error.code && ['EADDRINUSE', 'EACCES', 'EPERM'].includes(error.code)) {
      return true;
    }

    // 检查是否是JS引擎错误
    return fatalErrorTypes.includes(error.name);
  }

  /**
   * 创建Express错误处理中间件
   * @returns {Function} Express错误处理中间件
   */
  createExpressErrorHandler() {
    return (err, req, res, next) => {
      // 记录错误
      logger.error('Express请求处理错误:', {
        path: req.path,
        method: req.method,
        error: err.message,
        stack: err.stack,
        user: res.locals.userid || 'anonymous'
      });

      // 返回错误响应
      res.status(err.status || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production'
          ? '服务器内部错误'
          : err.message,
        code: err.status || 500
      });
    };
  }
}

// 导出单例实例
export default new ErrorHandlerService();