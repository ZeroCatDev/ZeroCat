#!/usr/bin/env node

/**
 * MaxMind GeoIP 数据库自动更新脚本
 *
 * 此脚本设计为定期运行，用于更新 MaxMind GeoIP 数据库
 * 可通过 cron 或系统计划任务定期执行
 */

import logger from '../utils/logger.js';
import configManager from '../utils/configManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.resolve(__dirname, '../data/GeoLite2-City.mmdb');
const DOWNLOAD_SCRIPT = path.resolve(__dirname, './downloadMaxmindDb.js');

/**
 * 检查数据库是否需要更新
 * 基于文件修改时间，默认30天更新一次
 */
async function checkNeedsUpdate(updateInterval = 30 * 24 * 60 * 60 * 1000) {
  // 如果文件不存在，需要更新
  if (!fs.existsSync(DB_FILE)) {
    logger.info('GeoIP数据库文件不存在，需要下载');
    return true;
  }

  try {
    const stats = fs.statSync(DB_FILE);
    const fileAge = Date.now() - stats.mtimeMs;

    // 检查配置的更新间隔，如果存在的话
    let configInterval = await configManager.getConfig('maxmind.update_interval');
    if (configInterval) {
      // 将天数转换为毫秒
      configInterval = parseInt(configInterval) * 24 * 60 * 60 * 1000;
      if (!isNaN(configInterval) && configInterval > 0) {
        updateInterval = configInterval;
      }
    }

    // 如果文件年龄超过更新间隔，需要更新
    if (fileAge > updateInterval) {
      logger.info(`GeoIP数据库文件已过时 (${Math.floor(fileAge / (24 * 60 * 60 * 1000))} 天)，需要更新`);
      return true;
    }

    logger.info(`GeoIP数据库文件仍然有效，不需要更新`);
    return false;
  } catch (error) {
    logger.error('检查GeoIP数据库文件状态失败:', error);
    return true; // 如果有错误，尝试更新
  }
}

/**
 * 检查是否启用了MaxMind
 */
async function isMaxMindEnabled() {
  try {
    const enabled = await configManager.getConfig('maxmind.enabled');
    return enabled === 'true' || enabled === '1';
  } catch (error) {
    logger.error('检查MaxMind启用状态时出错:', error);
    return false; // 默认禁用
  }
}

/**
 * 运行下载脚本
 */
async function runDownload() {
  try {
    // 显示明显的状态信息
    const statusLine = '='.repeat(60);
    console.log('\n' + statusLine);
    console.log('           正在更新 MaxMind GeoIP 数据库...');
    console.log(statusLine);

    // 检查许可证密钥和账户ID
    const licenseKey = await configManager.getConfig('maxmind.license_key');
    const accountId = await configManager.getConfig('maxmind.account_id');

    if (!licenseKey || !accountId) {
      logger.error('缺少MaxMind许可证密钥或账户ID，无法下载数据库');
      console.log('\n错误: 缺少MaxMind许可证密钥或账户ID\n');
      return false;
    }

    // 记录开始时间
    const startTime = Date.now();

    // 导入并使用下载模块
    const downloadModule = await import('./downloadMaxmindDb.js');

    // 手动加载配置到下载模块
    await downloadModule.default.loadMaxmindConfigFromDB();

    // 执行下载
    const success = await downloadModule.default.downloadDatabase();

    // 计算总耗时
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    // 显示下载结果
    console.log('\n' + statusLine);
    if (success) {
      console.log(`       ✓ GeoIP 数据库更新成功 (用时: ${elapsedSeconds}秒)`);
      logger.info(`GeoIP数据库更新成功，耗时: ${elapsedSeconds}秒`);

      // 检查是否需要动态重新加载
      if (shouldReloadDatabase()) {
        console.log(`       正在动态加载新数据库，无需重启应用...`);
        await reloadDatabase();
      }
    } else {
      console.log(`       ✗ GeoIP 数据库更新失败 (用时: ${elapsedSeconds}秒)`);
      logger.error(`GeoIP数据库更新失败，耗时: ${elapsedSeconds}秒`);
    }
    console.log(statusLine + '\n');

    return success;
  } catch (error) {
    logger.error('运行GeoIP数据库下载失败:', error);
    console.log('\n下载过程中发生错误，详情请查看日志\n');
    return false;
  }
}

/**
 * 检查是否指定了重新加载参数
 */
function shouldReloadDatabase() {
  return process.argv.includes('--reload') || process.argv.includes('--restart');
}

/**
 * 动态重新加载数据库
 */
async function reloadDatabase() {
  try {
    logger.info('准备动态加载GeoIP数据库...');

    // 显示准备中消息
    console.log('\n准备动态加载GeoIP数据库...');

    // 短暂延迟，让用户看到消息
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 动态导入ipLocation模块
    const { default: ipLocation } = await import('../utils/ipLocation.js');

    // 重新加载数据库
    console.log('\n' + '*'.repeat(60));
    console.log('*      正在动态加载 MaxMind GeoIP 数据库...               *');

    // 清理缓存并重新加载MaxMind配置和数据库
    await ipLocation.loadConfigFromDB();

    console.log('*      MaxMind GeoIP 数据库动态加载完成 ✓                *');
    console.log('*      应用正在使用新的GeoIP数据库，无需重启             *');
    console.log('*'.repeat(60) + '\n');

    logger.info('GeoIP数据库已动态加载，无需重启应用');
    return true;
  } catch (error) {
    logger.error('动态加载GeoIP数据库出错:', error);
    console.log('\n动态加载GeoIP数据库出错，详情请查看日志\n');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('\n开始检查 GeoIP 数据库更新状态...');
    logger.info('开始检查GeoIP数据库更新');

    // 检查是否启用了MaxMind
    if (!await isMaxMindEnabled()) {
      console.log('MaxMind GeoIP功能未启用，跳过更新');
      logger.info('MaxMind GeoIP功能未启用，跳过更新');
      process.exit(0);
    }

    // 检查是否需要更新
    if (await checkNeedsUpdate()) {
      // 运行下载
      if (await runDownload()) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    } else {
      console.log(`\n√ GeoIP 数据库文件已是最新版本，不需要更新\n`);
      logger.info('GeoIP数据库不需要更新');
      process.exit(0);
    }
  } catch (error) {
    logger.error('更新GeoIP数据库时发生错误:', error);
    console.error('\n更新GeoIP数据库时发生错误，详情请查看日志\n');
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// 导出功能以便其他模块调用
export default {
  checkNeedsUpdate,
  isMaxMindEnabled,
  runDownload,
  reloadDatabase,
  shouldReloadDatabase,
  DB_FILE
};