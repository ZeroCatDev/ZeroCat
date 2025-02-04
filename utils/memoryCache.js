class MemoryCache {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (item) {
      if (item.expiry && item.expiry < Date.now()) {
        this.cache.delete(key);
        return null;
      }
      return item.value;
    }
    return null;
  }

  set(key, value, ttlSeconds) {
    const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.cache.set(key, { value, expiry });
  }

  delete(key) {
    this.cache.delete(key);
  }

  // 清理过期的缓存项
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry && item.expiry < now) {
        this.cache.delete(key);
      }
    }
  }
}

export default new MemoryCache();

// 每小时清理一次过期的缓存项
setInterval(() => {
  MemoryCache.cleanup();
}, 3600000); 