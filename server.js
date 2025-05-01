#!/usr/bin/env node

/**
 * ZeroCat Backend 服务器入口文件
 */

import "dotenv/config";
import logger from './utils/logger.js';
import { serverConfig } from './src/index.js';

/**
 * 应用主函数
 */
async function main() {
  try {
    // 打印启动Banner
    printBanner();

    // 启动HTTP服务器
    await serverConfig.start();

    // 设置进程事件处理
    setupProcessHandlers();
  } catch (error) {
    logger.error('应用启动失败:', error);
    process.exit(1);
  }
}

/**
 * 打印启动Banner
 */
function printBanner() {
  const banner = `
=============================================================
|                 ZeroCat Backend Server
|
|  Version: ${process.env.npm_package_version || '1.0.0'}
|  Environment: ${process.env.NODE_ENV}
|  Node.js: ${process.version}
=============================================================
  `;
  console.log(banner);
}

/**
 * 设置进程事件处理
 */
function setupProcessHandlers() {
  // 处理SIGTERM信号
  process.on('SIGTERM', async () => {
    logger.info('接收到SIGTERM信号，开始优雅关闭...');
    await gracefulShutdown();
  });

  // 处理SIGINT信号
  process.on('SIGINT', async () => {
    logger.info('接收到SIGINT信号，开始优雅关闭...');
    await gracefulShutdown();
  });
}

/**
 * 优雅关闭应用
 */
async function gracefulShutdown() {
  try {
    logger.info('开始优雅关闭...');

    // 等待15秒后强制退出
    const forceExitTimeout = setTimeout(() => {
      logger.error('优雅关闭超时，强制退出');
      process.exit(1);
    }, 15000);

    // 关闭服务器
    await serverConfig.stop();

    // 取消强制退出定时器
    clearTimeout(forceExitTimeout);

    logger.info('应用已安全关闭');
    process.exit(0);
  } catch (error) {
    logger.error('关闭过程中出错:', error);
    process.exit(1);
  }
}

// 运行应用
main().catch(error => {
  logger.error('应用运行失败:', error);
  process.exit(1);
});