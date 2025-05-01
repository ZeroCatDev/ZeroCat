import logger from '../../utils/logger.js';
import http from 'http';
import app from '../../app.js';

/**
 * 服务器配置和启动类
 */
class ServerConfig {
  constructor() {
    this.port = process.env.PORT || 3000;
    this.host = process.env.HOST || '0.0.0.0';
    this.server = null;
  }

  /**
   * 启动HTTP服务器
   * @returns {Promise<http.Server>} HTTP服务器实例
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // 创建HTTP服务器
        this.server = http.createServer(app);

        // 设置错误处理
        this.server.on('error', this.handleServerError);

        // 启动服务器
        this.server.listen(this.port, this.host, () => {
          logger.info(`服务器已启动，监听 http://${this.host}:${this.port}`);
          resolve(this.server);
        });
      } catch (error) {
        logger.error('启动服务器失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 处理服务器错误
   * @param {Error} error 服务器错误
   */
  handleServerError(error) {
    if (error.code === 'EADDRINUSE') {
      logger.error(`端口 ${this.port} 已被占用，请尝试不同端口`);
    } else {
      logger.error('服务器错误:', error);
    }

    // 严重错误，退出进程
    process.exit(1);
  }

  /**
   * 关闭服务器
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.server) {
      logger.warn('尝试关闭未启动的服务器');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          logger.error('关闭服务器出错:', error);
          reject(error);
        } else {
          logger.info('服务器已优雅关闭');
          resolve();
        }
      });
    });
  }
}

// 导出配置类
export default new ServerConfig();