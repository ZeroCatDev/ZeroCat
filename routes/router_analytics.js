import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from "../services/logger.js";
import {UAParser} from 'ua-parser-js';
import ipLocation from '../services/ip/ipLocation.js';

const router = express.Router();
const prisma = new PrismaClient();

// URL 解析函数
function parseURL(url) {
  try {
    if (!url) return {};
    const urlObj = new URL(url);
    return {
      path: urlObj.pathname,
      query: urlObj.search || null,
      domain: urlObj.hostname,
    };
  } catch (error) {
    logger.error('[analytics] Failed to parse URL:', error);
    return {
      path: url,
      query: null,
      domain: null,
    };
  }
}

// UA 解析函数
function parseUserAgent(userAgent) {
  try {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    return {
      browser: result.browser.name || null,
      browser_version: result.browser.version || null,
      os: result.os.name || null,
      os_version: result.os.version || null,
      device_type: result.device.type || 'desktop',
      device_vendor: result.device.vendor || null,
    };
  } catch (error) {
    logger.error('[analytics] Failed to parse User-Agent:', error);
    return {};
  }
}

// IP 地理位置解析函数
async function parseIpLocation(ip) {
  try {
    const result = await ipLocation.getIPLocation(ip);
    return {
      country: result.most_specific_country_or_region || null,
      region: result.address || null,
      city: result.most_specific_country_or_region || null,
      timezone: result.location?.timeZone || null
    };
  } catch (error) {
    logger.error('[analytics] Failed to parse IP location:', error);
    return {
      country: null,
      region: null,
      city: null,
      timezone: null
    };
  }
}

// 统一的数据发送接口
router.post('/send', async (req, res) => {
  try {
    const {
      fingerprint,
      hostname,
      screen,
      language,
      url,
      referrer,
      page_title,
      target_type,
      target_id,
    } = req.body;

    const userAgent = req.headers['user-agent'];
    const uaInfo = parseUserAgent(userAgent);
    const ipInfo = await parseIpLocation(req.ip);

    // 解析 URL 和 referrer
    const urlInfo = parseURL(url);
    const referrerInfo = parseURL(referrer);

    // 获取当前用户ID（如果已登录）
    const currentUserId = res.locals.userid!==0 ? res.locals.userid : null;

    // 事务处理确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      // 查找策略：
      // 1. 如果用户已登录，先查找该用户的设备记录
      // 2. 如果未找到或用户未登录，查找无用户ID的设备记录
      let device = currentUserId
        ? await tx.ow_analytics_device.findUnique({
            where: {
              fingerprint_user_id: {
                fingerprint,
                user_id: currentUserId
              }
            }
          })
        : null;

      if (!device) {
        // 查找无用户ID的设备记录
        device = await tx.ow_analytics_device.findFirst({
          where: {
            fingerprint,
            user_id: null
          }
        });

        if (device && currentUserId) {
          // 如果找到无用户ID的设备且用户已登录，创建新的设备记录
          device = await tx.ow_analytics_device.create({
            data: {
              fingerprint,
              user_id: currentUserId,
              hostname,
              screen,
              language,
              browser: uaInfo.browser,
              browser_version: uaInfo.browser_version,
              os: uaInfo.os,
              os_version: uaInfo.os_version,
              device_type: uaInfo.device_type,
              device_vendor: uaInfo.device_vendor,
              user_agent: userAgent,
            }
          });
        } else if (device) {
          // 更新无用户ID的设备记录
          device = await tx.ow_analytics_device.update({
            where: { id: device.id },
            data: {
              last_seen: new Date(),
              hostname,
              screen,
              language,
              ...(device.user_agent !== userAgent ? {
                browser: uaInfo.browser,
                browser_version: uaInfo.browser_version,
                os: uaInfo.os,
                os_version: uaInfo.os_version,
                device_type: uaInfo.device_type,
                device_vendor: uaInfo.device_vendor,
                user_agent: userAgent,
              } : {})
            }
          });
        } else {
          // 创建新的设备记录（无用户ID或带用户ID）
          device = await tx.ow_analytics_device.create({
            data: {
              fingerprint,
              user_id: currentUserId,
              hostname,
              screen,
              language,
              browser: uaInfo.browser,
              browser_version: uaInfo.browser_version,
              os: uaInfo.os,
              os_version: uaInfo.os_version,
              device_type: uaInfo.device_type,
              device_vendor: uaInfo.device_vendor,
              user_agent: userAgent,
            }
          });
        }
      } else {
        // 更新已有的用户设备记录
        device = await tx.ow_analytics_device.update({
          where: { id: device.id },
          data: {
            last_seen: new Date(),
            hostname,
            screen,
            language,
            ...(device.user_agent !== userAgent ? {
              browser: uaInfo.browser,
              browser_version: uaInfo.browser_version,
              os: uaInfo.os,
              os_version: uaInfo.os_version,
              device_type: uaInfo.device_type,
              device_vendor: uaInfo.device_vendor,
              user_agent: userAgent,
            } : {})
          }
        });
      }

      // 创建事件记录
      const event = await tx.ow_analytics_event.create({
        data: {
          device_id: device.id,
          user_id: currentUserId,
          url,
          url_path: urlInfo.path,
          url_query: urlInfo.query,
          referrer,
          referrer_domain: referrerInfo.domain,
          referrer_path: referrerInfo.path,
          referrer_query: referrerInfo.query,
          page_title,
          target_type,
          target_id: Number(target_id),
          ip_address: req.ip,
          country: ipInfo.country,
          region: ipInfo.region,
          city: ipInfo.city,
          timezone: ipInfo.timezone,
        }
      });

      return { device, event };
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[analytics] Failed to record analytics data:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 获取统计数据
router.get('/stats', async (req, res) => {
  try {
    const { start_at, end_at, fingerprint, user_id } = req.query;

    const where = {
      created_at: {
        gte: new Date(start_at),
        lte: new Date(end_at),
      }
    };

    if (fingerprint) {
      where.device = {
        fingerprint
      };
    }

    if (user_id) {
      where.user_id = parseInt(user_id);
    }

    const events = await prisma.ow_analytics_event.findMany({
      where,
      include: {
        device: true
      }
    });

    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('[analytics] Failed to get stats:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;