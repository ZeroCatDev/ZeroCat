import fs from 'fs';
import logger from '../../utils/logger.js';
import ipLocation from '../../utils/ipLocation.js';
import configManager from '../../utils/configManager.js';
import paths from '../../src/paths.js';

/**
 * GeoIP服务 - 负责管理MaxMind GeoIP数据库
 * 提供数据库检查、加载、下载和动态更新功能
 */
class GeoIpService {

  /**
   * 检查数据库文件是否存在
   * @returns {boolean} 文件是否存在
   */
  checkDatabaseExists() {
    return fs.existsSync('./data/GeoLite2-City.mmdb');
  }

  /**
   * 从数据库加载GeoIP配置
   * @returns {Promise<boolean>} 加载结果
   */
  async loadConfig() {
    try {
      await ipLocation.loadConfigFromDB();
      logger.info('MaxMind GeoIP配置已从数据库加载');
      return true;
    } catch (error) {
      logger.error('加载MaxMind GeoIP配置失败:', error);
      return false;
    }
  }

  /**
   * 检查是否需要下载数据库
   * @returns {Promise<boolean>} 是否需要下载
   */
  async shouldDownloadDatabase() {
    try {
      // 检查是否启用
      const enabled = await configManager.getConfig('maxmind.enabled');
      if (enabled !== 'true' && enabled !== '1') {
        logger.info('MaxMind GeoIP未启用，跳过数据库检查');
        return false;
      }

      // 检查文件是否存在
      if (!this.checkDatabaseExists()) {
        logger.info('MaxMind GeoIP数据库文件不存在，需要下载');
        return true;
      }

      // 这里可以添加文件过期检查逻辑
      return false;
    } catch (error) {
      logger.error('检查GeoIP数据库状态失败:', error);
      return false;
    }
  }

  /**
   * 下载GeoIP数据库
   * @returns {Promise<boolean>} 下载是否成功
   */
  async downloadDatabase() {
    try {
      logger.info('开始下载MaxMind GeoIP数据库...');

      // 检查许可证密钥和账户ID
      const licenseKey = await configManager.getConfig('maxmind.license_key');
      const accountId = await configManager.getConfig('maxmind.account_id');

      if (!licenseKey || !accountId) {
        logger.error('缺少MaxMind许可证密钥或账户ID，无法下载数据库');
        return false;
      }

      // 导入下载模块
      const downloadModule = await import('../../tools/downloadMaxmindDb.js');

      // 加载配置到下载模块
      await downloadModule.default.loadMaxmindConfigFromDB();

      // 执行下载
      const success = await downloadModule.default.downloadDatabase();

      if (success) {
        logger.info('MaxMind GeoIP数据库下载成功');
        // 下载成功后重新初始化Reader
        await ipLocation.loadConfigFromDB();
        return true;
      } else {
        logger.error('MaxMind GeoIP数据库下载失败');
        return false;
      }
    } catch (error) {
      logger.error('下载MaxMind GeoIP数据库时出错:', error);
      return false;
    }
  }

  /**
   * 在后台下载数据库文件，不阻塞应用启动
   */
  startBackgroundDownload() {
    // 显示状态信息
    const statusLine = '*'.repeat(50);
    console.log('\n' + statusLine);
    console.log('* 正在后台下载 MaxMind GeoIP 数据库，应用继续启动 *');
    console.log(statusLine + '\n');

    // 在后台执行下载任务，不等待结果
    this.downloadDatabase()
      .then(success => {
        console.log('\n' + statusLine);
        if (success) {
          console.log('*      MaxMind GeoIP 数据库下载完成 ✓              *');
          console.log('*      正在动态加载新数据库...                     *');
          console.log(statusLine + '\n');

          // 直接加载新数据库，不重启应用
          ipLocation.loadConfigFromDB()
            .then(() => {
              console.log('\n' + statusLine);
              console.log('*      MaxMind GeoIP 数据库动态加载完成 ✓       *');
              console.log(statusLine + '\n');
            })
            .catch(err => {
              logger.error('动态加载GeoIP数据库失败:', err);
            });
        } else {
          console.log('*      MaxMind GeoIP 数据库下载失败 ✗              *');
          console.log('*    将使用模拟数据进行IP地址定位，请手动下载      *');
          console.log(statusLine + '\n');
        }
      })
      .catch(error => {
        logger.error('后台下载GeoIP数据库出错:', error);
      });
  }

  /**
   * 动态加载数据库，无需重启应用
   * @returns {Promise<boolean>} 加载是否成功
   */
  async reloadDatabase() {
    logger.info('准备动态加载GeoIP数据库...');

    try {
      console.log('\n' + '*'.repeat(50));
      console.log('*      正在动态加载 MaxMind GeoIP 数据库...        *');

      // 释放旧的Reader实例并重新加载配置
      await ipLocation.loadConfigFromDB();

      console.log('*      MaxMind GeoIP 数据库动态加载完成 ✓         *');
      console.log('*'.repeat(50) + '\n');

      logger.info('GeoIP数据库已动态加载');
      return true;
    } catch (error) {
      logger.error('动态加载GeoIP数据库失败:', error);
      return false;
    }
  }

  /**
   * 初始化GeoIP系统
   */
  async initialize() {
    // 加载配置
    await this.loadConfig();

    // 检查是否需要下载数据库
    if (await this.shouldDownloadDatabase()) {
      // 后台下载，不阻塞应用启动
      this.startBackgroundDownload();
    } else {
      logger.info('MaxMind GeoIP数据库已存在，无需下载');
    }
  }
}

// 导出单例实例
export default new GeoIpService();