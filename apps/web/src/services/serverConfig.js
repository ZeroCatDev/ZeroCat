import axios from '@/axios/axios';

// 配置常量
const CONFIG_CONSTANTS = {
  STORAGE_KEY: {
    DATA: 'config_data',
    LAST_FETCH: 'config_last_fetch_time',
  },
  MAX_AGE: 5 * 60 * 1000, // 5分钟
  REFRESH_INTERVAL: 5 * 60 * 1000, // 5分钟
};

// 从localStorage获取数据
function getStoredData() {
  try {
    const stored = localStorage.getItem(CONFIG_CONSTANTS.STORAGE_KEY.DATA);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to parse stored config:', error);
    return {};
  }
}

// 保存数据到localStorage
function setStoredData(data) {
  try {
    localStorage.setItem(CONFIG_CONSTANTS.STORAGE_KEY.DATA, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to store config:', error);
  }
}

// 获取最后刷新时间
function getLastFetchTime() {
  const timestamp = localStorage.getItem(CONFIG_CONSTANTS.STORAGE_KEY.LAST_FETCH);
  return timestamp ? parseInt(timestamp, 10) : 0;
}

// 更新最后刷新时间
function updateLastFetchTime() {
  localStorage.setItem(CONFIG_CONSTANTS.STORAGE_KEY.LAST_FETCH, Date.now().toString());
}

// 检查是否需要刷新
function needsRefresh() {
  const lastFetch = getLastFetchTime();
  const now = Date.now();
  return now - lastFetch > CONFIG_CONSTANTS.MAX_AGE;
}
// 获取配置数据
export function fetchConfig() {
  return axios.get('/api/config')
    .then(response => {
      setStoredData(response.data);
      updateLastFetchTime();
      return response.data;
    })
    .catch(error => {
      console.error('Failed to fetch config:', error);
      // 如果获取失败，返回缓存的数据
      return getStoredData();
    });
}


// 智能获取配置
export function get(key) {
  // 始终返回本地缓存，避免在刷新窗口内返回 Promise 导致取值为 undefined
  const data = getStoredData();
  if (needsRefresh()) {
    // 触发后台刷新，不阻塞当前读取
    fetchConfig().catch(() => {});
  }

  // 如果指定了key，返回对应的值
  if (key !== undefined) {
    return data[key];
  }

  // 否则返回所有数据
  return data;
}

// 启动自动刷新
setInterval(fetchConfig, CONFIG_CONSTANTS.REFRESH_INTERVAL);

// 初始化获取配置
fetchConfig();

// 导出配置对象
export const config = getStoredData();
export default config;
