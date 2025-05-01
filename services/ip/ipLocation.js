import logger from "../logger.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Reader } from '@maxmind/geoip2-node';
import zcconfig from '../config/zcconfig.js';

// 固定的数据库文件路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.resolve(__dirname, '../data/GeoLite2-City.mmdb');

// 配置参数
const CONFIG = {
  enabled: false // 是否启用MaxMind
};

// 存储Reader实例
let geoipReader = null;

// 从数据库加载配置
const loadConfigFromDB = async () => {
  try {
    const enabled = await zcconfig.get('maxmind.enabled');
    if (enabled !== null) {
      CONFIG.enabled = enabled === 'true' || enabled === '1';
    }

    // 使用DEBUG级别日志，避免频繁输出
    logger.debug('已从数据库加载MaxMind配置', CONFIG);

    // 加载配置后初始化
    initMaxMind();

    return CONFIG;
  } catch (error) {
    logger.error('从数据库加载MaxMind配置失败:', error);
  }
};

// 初始化MaxMind数据库
const initMaxMind = () => {
  // 释放旧的Reader实例，如果存在
  if (geoipReader) {
    geoipReader = null;
    // 在Javascript中不需要明确释放，GC会处理
  }

  if (!CONFIG.enabled) {
    logger.debug('MaxMind GeoIP未启用，跳过初始化');
    return;
  }

  try {
    // 检查数据库文件是否存在
    if (!fs.existsSync(DB_FILE)) {
      logger.debug(`MaxMind GeoIP数据库文件不存在: ${DB_FILE}，等待后台下载完成`);
      return;
    }

    // 加载数据库
    const dbBuffer = fs.readFileSync(DB_FILE);
    geoipReader = Reader.openBuffer(dbBuffer);
    logger.info('MaxMind GeoIP数据库加载成功');
  } catch (error) {
    // 避免在初始化时产生过多错误日志，只在真正失败时记录
    if (fs.existsSync(DB_FILE)) {
      logger.error('初始化MaxMind GeoIP数据库失败:', error);
    } else {
      logger.debug('MaxMind GeoIP数据库文件不存在，等待下载');
    }
  }
};

// 自动加载数据库配置并初始化
loadConfigFromDB();

/**
 * 获取IP地址的地理位置信息
 * 支持MaxMind GeoIP数据库和模拟数据
 * @param {string} ipAddress - 需要定位的IP地址
 * @returns {Object} 地理位置信息
 */
const getIPLocation = async (ipAddress) => {
  // 如果MaxMind已启用且初始化成功
  if (CONFIG.enabled && geoipReader) {
    try {
      // 尝试使用MaxMind查询
      const response = geoipReader.city(ipAddress);

      return {
        ip: ipAddress,
        country: response.country?.names?.zh_CN || response.country?.names?.en || '未知',
        country_code: response.country?.isoCode || '',
        region: response.subdivisions?.[0]?.names?.zh_CN || response.subdivisions?.[0]?.names?.en || '',
        city: response.city?.names?.zh_CN || response.city?.names?.en || '',
        latitude: response.location?.latitude || 0,
        longitude: response.location?.longitude || 0,
        isp: response.traits?.isp || ''
      };
    } catch (error) {
      // MaxMind查询失败，记录错误
      logger.error(`MaxMind查询IP(${ipAddress})位置失败:`, error);
      // 继续使用模拟数据作为备选
    }
  }

  try {
    // 模拟数据
    return {
      ip: ipAddress,
      country: "暂无国",
      country_code: "ZW",
      region: "暂无省",
      city: "暂无",
      latitude: 0,
      longitude: 0,
      isp: "暂无运营商"
    };
  } catch (error) {
    logger.error("获取IP地址位置时出错:", error);
    return {
      ip: ipAddress,
      country: "未知",
      country_code: "",
      region: "",
      city: "",
      latitude: 0,
      longitude: 0,
      isp: ""
    };
  }
};

/**
 * 更新MaxMind配置
 * @param {Object} config - 新配置
 */
const updateConfig = async (config) => {
  // 更新内存中的配置
  if (config.enabled !== undefined) {
    CONFIG.enabled = config.enabled;
  }

  // 更新数据库中的配置
  try {
    // 获取现有的PrismaClient实例
    const { prisma } = await import('@prisma/client').then(module => ({
      prisma: new module.PrismaClient()
    }));

    // 更新数据库配置
    if (config.enabled !== undefined) {
      await prisma.ow_config.upsert({
        where: { key: 'maxmind.enabled' },
        update: { value: config.enabled.toString() },
        create: { key: 'maxmind.enabled', value: config.enabled.toString(), is_public: 0 }
      });
    }

    if (config.licenseKey !== undefined) {
      await prisma.ow_config.upsert({
        where: { key: 'maxmind.license_key' },
        update: { value: config.licenseKey },
        create: { key: 'maxmind.license_key', value: config.licenseKey, is_public: 0 }
      });
    }

    if (config.accountId !== undefined) {
      await prisma.ow_config.upsert({
        where: { key: 'maxmind.account_id' },
        update: { value: config.accountId },
        create: { key: 'maxmind.account_id', value: config.accountId, is_public: 0 }
      });
    }

    logger.info('MaxMind配置已保存到数据库');
    await prisma.$disconnect();
  } catch (error) {
    logger.error('保存MaxMind配置到数据库失败:', error);
  }

  // 重新初始化
  initMaxMind();

  return {...CONFIG};
};

// 导出模块
export default {
  getIPLocation,
  updateConfig,
  get: () => ({...CONFIG}),
  loadConfigFromDB
};