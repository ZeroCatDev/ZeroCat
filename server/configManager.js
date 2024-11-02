// configManager.js
const { PrismaClient } = require('@prisma/client');

class ConfigManager {
    constructor() {
        this.prisma = new PrismaClient();
        this.config = {};
    }

    async loadAllConfigs() {
        const configs = await this.prisma.newconfig.findMany();
        configs.forEach(({ key, value }) => {
            this.config[key] = value;
        });
        global.configManager = this.config

    }

    initialize() {
        return this.loadAllConfigs(); // 将 initialize 方法定义为加载所有配置
    }

    async getConfig(key) {
        //console.log(this.config)

        // 检查值是否已经缓存
        if (this.config[key]) {
            return this.config[key];
        }
        // 如果未缓存，则从数据库获取
        return await this.getConfigFromDB(key);
    }

    getConfigSync(key) {
        //console.log(this.config)

        // 检查值是否已经缓存
        if (this.config[key]) {
            return this.config[key];
        }

        // 如果未缓存，直接从数据库获取
        const config = this.prisma.newconfig.findFirst({
            where: { key: key }
        });
        this.config[key] = config ? config.value : null;
        return config ? config.value : null;
    }

    async loadAndCacheAll() {
        await this.loadAllConfigs();
    }


    async getConfigFromDB(key) {
        const config = await this.prisma.newconfig.findFirst({
            where: { key: key }
        });

        if (config) {
            this.config[key] = config.value; // 缓存获取的值
            return config.value;
        }

        throw new Error(`Config key "${key}" not found.`);
    }
}
// 使用单例模式
const configManagerInstance = new ConfigManager();
module.exports = configManagerInstance;
