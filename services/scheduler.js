import logger from '../utils/logger.js';
import authUtils from '../utils/auth.js';

/**
 * 任务调度服务 - 管理应用中的定时任务
 */
class SchedulerService {
  constructor() {
    this.tasks = [];
    this.intervals = {};
    this.initialized = false;
  }

  /**
   * 初始化任务调度器
   */
  initialize() {
    // 防止重复初始化
    if (this.initialized) {
      logger.debug('任务调度器已初始化，跳过重复初始化');
      return;
    }

    logger.info('初始化任务调度器...');
    this.registerTasks();
    this.startTasks();
    this.initialized = true;
  }

  /**
   * 注册应用所需的定时任务
   */
  registerTasks() {
    // 清空之前可能注册的任务，避免重复注册
    this.tasks = [];

    // 注册令牌清理任务（每12小时执行一次）
    this.registerTask('tokenCleanup', async () => {
      try {
        logger.info('执行过期令牌清理任务...');
        await authUtils.cleanupExpiredTokens();
        logger.info('过期令牌清理任务完成');
      } catch (error) {
        logger.error('清理过期令牌出错:', error);
      }
    }, 12 * 60 * 60 * 1000);

    // 可以在这里注册更多任务
  }

  /**
   * 注册定时任务
   * @param {string} name 任务名称
   * @param {Function} task 任务函数
   * @param {number} interval 执行间隔（毫秒）
   */
  registerTask(name, task, interval) {
    // 检查是否已经注册了同名任务
    if (this.tasks.some(t => t.name === name)) {
      logger.debug(`任务 ${name} 已存在，跳过注册`);
      return;
    }

    this.tasks.push({ name, task, interval });
    logger.info(`已注册定时任务: ${name}, 间隔: ${interval}ms`);
  }

  /**
   * 启动所有注册的定时任务
   */
  startTasks() {
    // 先停止所有任务，避免重复启动
    this.stopTasks();

    for (const { name, task, interval } of this.tasks) {
      this.intervals[name] = setInterval(task, interval);
      logger.info(`已启动定时任务: ${name}`);
    }
  }

  /**
   * 停止所有定时任务
   */
  stopTasks() {
    for (const [name, intervalId] of Object.entries(this.intervals)) {
      clearInterval(intervalId);
      logger.info(`已停止定时任务: ${name}`);
    }
    this.intervals = {};
  }
}

// 导出单例实例
export default new SchedulerService();