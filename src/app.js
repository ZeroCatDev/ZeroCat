import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../services/logger.js";

// 导入配置模块
import { configureMiddleware } from "./index.js";
import { configureRoutes } from "./routes.js";

// 导入服务
import geoIpService from "../services/ip/geoIpService.js";
import schedulerService from "../services/scheduler.js";
import errorHandlerService from "../services/errorHandler.js";

// 全局初始化标志，防止重复初始化
global.appInitialized = global.appInitialized || false;

/**
 * 应用程序主类
 */
class Application {
  constructor() {
    this.app = express();
    this._initPromise = this.configureApp();
  }

  /**
   * 获取初始化完成的Promise
   * @returns {Promise} 初始化Promise
   */
  get initialized() {
    return this._initPromise;
  }

  /**
   * 配置应用程序
   */
  async configureApp() {
    try {
      // 配置中间件
      await configureMiddleware(this.app);

      // 配置路由
      await configureRoutes(this.app);

      // 添加全局错误处理中间件
      this.app.use(errorHandlerService.createExpressErrorHandler());

      // 设置未捕获异常处理
      this.setupExceptionHandling();

      logger.info('应用程序配置完成');
    } catch (error) {
      logger.error('应用配置失败:', error);
      process.exit(1);
    }
  }

  /**
   * 设置全局异常处理
   */
  setupExceptionHandling() {
    // 使用错误处理服务注册全局处理器
    errorHandlerService.registerGlobalHandlers();
  }

  /**
   * 初始化服务
   */
  async initializeServices() {
    try {
      // 防止重复初始化服务
      if (global.appInitialized) {
        logger.debug('服务已经初始化过，跳过重复初始化');
        return;
      }

      logger.info('开始初始化服务...');

      // 初始化GeoIP服务
      await geoIpService.initialize().catch(error => {
        logger.error('初始化MaxMind GeoIP失败:', error);
      });

      // 初始化调度服务
      schedulerService.initialize();

      logger.info('所有服务初始化完成');

      // 标记应用已初始化
      global.appInitialized = true;
    } catch (error) {
      logger.error('服务初始化失败:', error);
    }
  }

  /**
   * 启动应用
   * @returns {express.Application} Express应用实例
   */
  getApp() {
    return this.app;
  }
}

// 创建应用实例
const application = new Application();

// 初始化服务
Promise.all([
  application.initialized,
  application.initializeServices()
]).catch(error => {
  logger.error('初始化失败:', error);
});

// 导出Express应用实例
export default application.getApp();
