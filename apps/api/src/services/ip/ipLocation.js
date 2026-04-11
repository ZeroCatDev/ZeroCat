import logger from "../logger.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {Reader} from "@maxmind/geoip2-node";
import zcconfig from "../config/zcconfig.js";
import downloadMaxmindDb from "./downloadMaxmindDb.js";
// 固定的数据库文件路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.resolve(__dirname, "../../../cache/ip/GeoLite2-City.mmdb");

// 配置参数
var CONFIG = {
    enabled: false, // 是否启用MaxMind
};

// 存储Reader实例
let geoipReader = null;
const defaultResponse = {
    address: "未知",
    most_specific_country_or_region: "未知",
    location: {
        accuracyRadius: -1,
        latitude: 0,
        longitude: 0,
        metroCode: -1,
        timeZone: "未知",
    },
};
// 从数据库加载配置
const loadConfigFromDB = async () => {

    try {
        const enabled = await zcconfig.get("maxmind.enabled");
        logger.debug("[ip] 从数据库加载MaxMind配置:", enabled);
        if (enabled !== null) {
            CONFIG.enabled = enabled === true;
        }
        logger.debug("[ip] 已从数据库加载MaxMind配置", CONFIG);
        await initMaxMind();
        return CONFIG;
    } catch (error) {
        logger.error("[ip] 从数据库加载MaxMind配置失败:", error);
    }
};

// 初始化MaxMind数据库
const initMaxMind = async () => {
    if (geoipReader) {
        geoipReader = null;
    }

    if (!CONFIG.enabled) {
        logger.debug("[ip] MaxMind GeoIP未启用，跳过初始化");
        return;
    }

    try {
        await downloadMaxmindDb.loadMaxmind();

        // 加载数据库
        const dbBuffer = fs.readFileSync(DB_FILE);
        geoipReader = Reader.openBuffer(dbBuffer);
        logger.info("[ip] MaxMind GeoIP数据库加载成功");
    } catch (error) {
        logger.error("[ip] 初始化MaxMind GeoIP数据库失败:", error);
        geoipReader = null;
    }
};

/**
 * 获取IP地址的地理位置信息
 * @param {string} ipAddress - 需要定位的IP地址
 * @returns {Object} 地理位置信息
 {
 *   address: "未知",
 *   most_specific_country_or_region: "未知",
 *   location: {
 *     accuracyRadius: -1,
 *     latitude: 0,
 *     longitude: 0,
 *     metroCode: -1,
 *     timeZone: "未知",
 *   },
 * }
 */
const getIPLocation = async (ipAddress) => {
    if (!ipAddress) {
        logger.warn("[ip] IP地址为空");
        return defaultResponse;
    }

    if (CONFIG.enabled && geoipReader) {
        try {
            const response = geoipReader.city(ipAddress);
            if (!response) {
                logger.debug(`[ip] MaxMind查询IP(${ipAddress})位置失败: 返回空响应`);
                return defaultResponse;
            }

            return {
                address: `${
                    response.city?.names?.["zh-CN"] || response.city?.names?.en || ""
                } ${
                    response.subdivisions?.[0]?.names?.["zh-CN"] ||
                    response.subdivisions?.[0]?.names?.en ||
                    ""
                } ${
                    response.country?.names?.["zh-CN"] ||
                    response.country?.names?.en ||
                    "未知"
                } (${response.country?.isoCode || ""}) ${
                    response.continent?.names?.["zh-CN"] ||
                    response.continent?.names?.en ||
                    ""
                }`,
                most_specific_country_or_region:
                    response.city?.names?.["zh-CN"] ||
                    // response.city?.names?.en ||
                    response.subdivisions?.[0]?.names?.["zh-CN"] ||
                    // response.subdivisions?.[0]?.names?.en ||
                    response.country?.names?.["zh-CN"] ||
                    // response.country?.names?.en ||
                    response.continent?.names?.["zh-CN"] ||
                    // response.continent?.names?.en ||
                    response.registeredCountry?.names?.["zh-CN"] ||
                    response.registeredCountry?.names?.en ||
                    "未知",

                location: response.location,
                //response: response,
            };
        } catch (error) {
            logger.debug(`[ip] MaxMind查询IP(${ipAddress})位置失败: ${error.message}`);
        }
    }

    return defaultResponse;
};

// 导出模块
export default {
    getIPLocation,
    loadConfigFromDB,
};
