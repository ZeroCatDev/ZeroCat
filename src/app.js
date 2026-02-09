import "dotenv/config";
import * as Sentry from "@sentry/node";
import express from "express";
import logger from "./services/logger.js";

// 导入配置模块
import {configureMiddleware} from "./index.js";
import {configureRoutes} from "./routes.js";
import zcconfigInstance from "./services/config/zcconfig.js";

// 导入服务
import geoIpService from "./services/ip/ipLocation.js";
import errorHandlerService from "./services/errorHandler.js";
import sitemapService from './services/sitemap.js';
import codeRunManager from './services/coderunManager.js';
import queueManager from './services/queue/queueManager.js';

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
            logger.debug('[app] 开始配置应用程序...');

            // 初始化配置并设置为全局变量
            await zcconfigInstance.initialize();
            global.config = {};

            // 设置全局配置访问器
            Object.defineProperty(global, 'config', {
                get: () => {
                    const configs = {};
                    for (const [key, value] of zcconfigInstance.cache.entries()) {
                        configs[key] = value;
                    }
                    return configs;
                },
                configurable: false,
                enumerable: true
            });

            // 设置全局公共配置访问器
            Object.defineProperty(global, 'publicconfig', {
                get: () => {
                    return zcconfigInstance.getPublicConfigs();
                },
                configurable: false,
                enumerable: true
            });

            // 配置中间件
            await configureMiddleware(this.app);
            logger.debug('[app] 中间件配置完成');
            // 配置路由
            await configureRoutes(this.app);
            logger.debug('[app] 路由配置完成');

            // Sentry 错误处理器应该在所有控制器之后，其他错误中间件之前设置
            Sentry.setupExpressErrorHandler(this.app);

            // 添加全局错误处理中间件
            this.app.use(errorHandlerService.createExpressErrorHandler());
            logger.debug('[app] 全局错误处理中间件配置完成');
            // 设置未捕获异常处理
            this.setupExceptionHandling();
            logger.debug('[app] 未捕获异常处理配置完成');
            // 初始化sitemap服务
            await sitemapService.initialize();
            logger.debug('[app] sitemap服务初始化完成');
            logger.info('[app] 应用程序配置完成');
        } catch (error) {
            logger.error('[app] 应用配置失败:', error);
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
                logger.debug('[app] 服务已经初始化过，跳过重复初始化');
                return;
            }

            logger.info('[app] 开始初始化服务...');
//TODO 初始化MaxMind GeoIP服务
            // 初始化GeoIP服务
            await geoIpService.loadConfigFromDB().catch(error => {
                logger.error('[app] 初始化MaxMind GeoIP失败:', error);
            });

            // 初始化BullMQ任务队列
            await queueManager.initialize().catch(error => {
                logger.error('[app] BullMQ初始化失败:', error);
            });

            // Initialize CodeRunManager
            await codeRunManager.initialize();

            logger.info('[app] 所有服务初始化完成');

            // 标记应用已初始化
            global.appInitialized = true;
        } catch (error) {
            logger.error('[app] 服务初始化失败:', error);
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
    logger.error('[app] 初始化失败:', error);
});

// 导出Express应用实例
export default application.getApp();
