#!/usr/bin/env node

import "./src/instrument.js";

/**
 * ZeroCat Backend 服务器入口文件
 */

import "dotenv/config";
import logger from './src/services/logger.js';
import {serverConfig} from './src/index.js';
import {execSync} from 'child_process';
import fs from 'fs';
import queueManager from './src/services/queue/queueManager.js';
import smtpGateway from './src/services/smtpGateway.js';

// 定义需要检查的目录列表
const REQUIRED_DIRECTORIES = [
    'cache',
    'cache/ip',
    'cache/usercontent'
];

/**
 * 检查并创建必需的目录
 */
async function ensureDirectories() {
    logger.info('[server] 检查必需目录...');

    for (const dir of REQUIRED_DIRECTORIES) {
        try {
            if (!fs.existsSync(dir)) {
                logger.info(`[server] 创建目录: ${dir}`);
                fs.mkdirSync(dir, {recursive: true});
            }
        } catch (error) {
            logger.error(`[server] 创建目录失败 ${dir}:`, error);
            throw error;
        }
    }

    logger.info('[server] 目录检查完成');
}

/**
 * 运行Prisma迁移和生成
 */
async function runPrismaMigrations() {
    // 在调试模式下跳过迁移
    if (process.env.NODE_ENV === 'development') {
        logger.info('[prisma] 调试模式：跳过Prisma迁移和生成');
        return;
    }

    try {
        logger.info('[prisma] 开始运行Prisma迁移...');
        execSync('npx prisma migrate deploy', {stdio: 'inherit'});
        logger.info('[prisma] Prisma迁移完成');

        logger.info('[prisma] 开始生成Prisma客户端...');
        execSync('npx prisma generate', {stdio: 'inherit'});
        logger.info('[prisma] Prisma客户端生成完成');
    } catch (error) {
        logger.error('[prisma] Prisma迁移或生成失败:', error);
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

        // 检查必需目录
        await ensureDirectories();

        // 运行Prisma迁移和生成
        await runPrismaMigrations();

        // 启动HTTP服务器
        await serverConfig.start();

        // 设置进程事件处理
        setupProcessHandlers();
    } catch (error) {
        logger.error('[server] 应用启动失败:', error);
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
        logger.info('[server] 接收到SIGTERM信号，开始关闭...');
        await gracefulShutdown();
    });

    // 处理SIGINT信号
    process.on('SIGINT', async () => {
        logger.info('[server] 接收到SIGINT信号，开始关闭...');
        await gracefulShutdown();
    });
}

/**
 * 优雅关闭应用
 */
async function gracefulShutdown() {
    try {
        logger.info('[server] 开始关闭...');

        // 等待15秒后强制退出
        const forceExitTimeout = setTimeout(() => {
            logger.error('[server] 关闭超时，强制退出');
            process.exit(1);
        }, 15000);

        // 关闭BullMQ队列
        await queueManager.shutdown();

        // 关闭SMTP网关
        await smtpGateway.shutdown();

        // 关闭服务器
        await serverConfig.stop();

        // 取消强制退出定时器
        clearTimeout(forceExitTimeout);

        logger.info('[server] 应用已安全关闭');
        process.exit(0);
    } catch (error) {
        logger.error('[server] 关闭过程中出错:', error);
        process.exit(1);
    }
}

// 运行应用
main().catch(error => {
    logger.error('[server] 应用运行失败:', error);
    process.exit(1);
});
