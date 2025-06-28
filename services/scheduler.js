/**
 * @fileoverview 定时任务调度服务
 * 负责管理和执行系统中的各种定时任务
 */
import logger from './logger.js';

// 存储所有注册的任务
const tasks = new Map();

// 存储任务执行句柄，用于停止任务
const taskHandles = new Map();

/**
 * 任务调度器服务
 */
class SchedulerService {
  /**
   * 初始化调度器
   */
  initialize() {
    logger.info('[scheduler] 正在初始化调度器服务...');

    // 注册默认任务
    this.registerDefaultTasks();

    // 启动所有任务
    this.startAllTasks();

    logger.info('[scheduler] 调度器服务初始化完成');

    return this;
  }

  /**
   * 注册默认任务
   */
  registerDefaultTasks() {
    // 示例：注册一个每小时执行一次的清理任务
    this.registerTask('hourly-cleanup', {
      interval: 60 * 60 * 1000, // 1小时
      handler: async () => {
        try {
          logger.info('[scheduler] 执行每小时清理任务');
          // 实际清理逻辑
        } catch (error) {
          logger.error('[scheduler] 每小时清理任务失败:', error);
        }
      }
    });

    // 示例：注册一个每天执行一次的统计任务
    this.registerTask('daily-stats', {
      interval: 24 * 60 * 60 * 1000, // 24小时
      handler: async () => {
        try {
          logger.info('[scheduler] 执行每日统计任务');
          // 实际统计逻辑
        } catch (error) {
          logger.error('[scheduler] 每日统计任务失败:', error);
        }
      }
    });
  }

  /**
   * 注册一个新任务
   * @param {string} taskId - 任务ID
   * @param {Object} taskConfig - 任务配置
   * @param {number} taskConfig.interval - 任务执行间隔(毫秒)
   * @param {Function} taskConfig.handler - 任务处理函数
   * @param {boolean} [taskConfig.runImmediately=false] - 是否立即执行一次
   * @returns {boolean} 是否注册成功
   */
  registerTask(taskId, taskConfig) {
    if (tasks.has(taskId)) {
      logger.warn(`[scheduler] 任务 ${taskId} 已经存在，请先移除`);
      return false;
    }

    tasks.set(taskId, taskConfig);
    logger.info(`[scheduler] 任务 ${taskId} 注册成功`);

    // 如果需要立即启动
    if (taskConfig.runImmediately) {
      this.startTask(taskId);
    }

    return true;
  }

  /**
   * 移除一个任务
   * @param {string} taskId - 任务ID
   * @returns {boolean} 是否移除成功
   */
  removeTask(taskId) {
    if (!tasks.has(taskId)) {
      logger.warn(`[scheduler] 任务 ${taskId} 不存在`);
      return false;
    }

    // 停止任务
    this.stopTask(taskId);

    // 从注册表中移除
    tasks.delete(taskId);
    logger.info(`[scheduler] 任务 ${taskId} 已移除`);

    return true;
  }

  /**
   * 启动一个任务
   * @param {string} taskId - 任务ID
   * @returns {boolean} 是否启动成功
   */
  startTask(taskId) {
    if (!tasks.has(taskId)) {
      logger.warn(`[scheduler] 任务 ${taskId} 不存在`);
      return false;
    }

    if (taskHandles.has(taskId)) {
      logger.warn(`[scheduler] 任务 ${taskId} 已经在运行`);
      return false;
    }

    const task = tasks.get(taskId);

    // 如果需要立即执行一次
    if (task.runImmediately) {
      task.handler().catch(err => logger.error(`[scheduler] 任务 ${taskId} 立即执行失败:`, err));
    }

    // 设置定时执行
    const handle = setInterval(() => {
      task.handler().catch(err => logger.error(`[scheduler] 任务 ${taskId} 执行失败:`, err));
    }, task.interval);

    // 保存任务句柄
    taskHandles.set(taskId, handle);
    logger.info(`[scheduler] 任务 ${taskId} 已启动，间隔 ${task.interval}ms`);

    return true;
  }

  /**
   * 停止一个任务
   * @param {string} taskId - 任务ID
   * @returns {boolean} 是否停止成功
   */
  stopTask(taskId) {
    if (!taskHandles.has(taskId)) {
      logger.warn(`[scheduler] 任务 ${taskId} 未在运行`);
      return false;
    }

    // 清除定时器
    clearInterval(taskHandles.get(taskId));

    // 从运行表中移除
    taskHandles.delete(taskId);
    logger.info(`[scheduler] 任务 ${taskId} 已停止`);

    return true;
  }

  /**
   * 启动所有注册的任务
   */
  startAllTasks() {
    logger.info('[scheduler] 正在启动所有注册的任务...');

    for (const taskId of tasks.keys()) {
      this.startTask(taskId);
    }

    logger.info(`[scheduler] 已启动 ${taskHandles.size} 个任务`);
  }

  /**
   * 停止所有运行中的任务
   */
  stopAllTasks() {
    logger.info('[scheduler] 正在停止所有运行中的任务...');

    for (const taskId of taskHandles.keys()) {
      this.stopTask(taskId);
    }

    logger.info('[scheduler] 所有任务已停止');
  }

  /**
   * 检查任务是否正在运行
   * @param {string} taskId - 任务ID
   * @returns {boolean} 是否正在运行
   */
  isTaskRunning(taskId) {
    return taskHandles.has(taskId);
  }
}

// 创建单例实例
const schedulerService = new SchedulerService();

export default schedulerService;