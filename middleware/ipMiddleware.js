import ipUtils from '../services/utils/ipUtils.js';

/**
 * IP地址中间件
 * 为请求对象添加IP地址信息
 */
export const ipMiddleware = (req, res, next) => {
  // 获取并存储IP信息
  const clientIP = ipUtils.getClientIP(req);
  const realIP = ipUtils.getRealIP(req);
  const isPrivateIP = ipUtils.isPrivateIP(realIP);

  // 在请求对象上添加IP信息
  req.ipInfo = {
    clientIP,     // 优先获取的公网IP
    realIP,       // 真实连接IP
    isPrivateIP,  // 是否是私有IP
    proxyIPs: req.headers['x-forwarded-for'] ?
      req.headers['x-forwarded-for'].split(',').map(ip => ip.trim()) :
      []          // 代理IP链
  };

  next();
};

export default ipMiddleware;