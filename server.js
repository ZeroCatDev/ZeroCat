#!/usr/bin/env node

/**
 * ZeroCat Backend 服务器入口文件
 */

import "dotenv/config";
import logger from './services/logger.js';
import { serverConfig } from './src/index.js';
import { execSync } from 'child_process';

/**
 * 运行Prisma迁移和生成
 */
async function runPrismaMigrations() {
  // 在调试模式下跳过迁移
  if (process.env.NODE_ENV === 'development') {
    logger.info('调试模式：跳过Prisma迁移和生成');
    return;
  }

  try {
    logger.info('开始运行Prisma迁移...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    logger.info('Prisma迁移完成');

    logger.info('开始生成Prisma客户端...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    logger.info('Prisma客户端生成完成');
  } catch (error) {
    logger.error('Prisma迁移或生成失败:', error);
    throw error;
  }
}

/**
 * 应用主函数
 */
async function main() {
  try {
    // 打印启动Banner
    printBanner();

    // 运行Prisma迁移和生成
    await runPrismaMigrations();

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
 ZeroCat Backend Server

 Version: ${process.env.npm_package_version || '1.0.0'}
 Environment: ${process.env.NODE_ENV}
 Node.js: ${process.version}
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
    logger.info('接收到SIGTERM信号，开始关闭...');
    await gracefulShutdown();
  });

  // 处理SIGINT信号
  process.on('SIGINT', async () => {
    logger.info('接收到SIGINT信号，开始关闭...');
    await gracefulShutdown();
  });
}

/**
 * 优雅关闭应用
 */
async function gracefulShutdown() {
  try {
    logger.info('开始关闭...');

    // 等待15秒后强制退出
    const forceExitTimeout = setTimeout(() => {
      logger.error('关闭超时，强制退出');
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