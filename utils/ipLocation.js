import logger from "./logger.js";

/**
 * 获取IP地址的地理位置信息
 * 目前返回假数据，后续可对接真实IP定位服务
 */
const getIPLocation = async (ipAddress) => {
  try {
    // 模拟API调用延迟
    //await new Promise(resolve => setTimeout(resolve, 100));

    // 返回虚拟位置数据
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

export default {
  getIPLocation
};