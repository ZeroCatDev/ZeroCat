import logger from "../logger.js";
import {prisma} from "../prisma.js";
import {CONFIG_TYPES, getDefaultValue, validateConfig} from "./configTypes.js";

class ZCConfig {
    constructor() {
        // Initialize cache
        this.cache = new Map();
        this.publicCache = new Map();
        this.configInfo = [];
        this.initialized = false;
        this.initializationPromise = null;
    }

    async initialize() {
        if (this.initialized) {
            //logger.debug("[config] 配置已初始化，跳过重复初始化");
            return true;
        }

        if (this.initializationPromise) {
            logger.debug("[config] 配置初始化正在进行中，等待完成");
            return this.initializationPromise;
        }

        this.initializationPromise = this._initialize();
        return this.initializationPromise;
    }

    async _initialize() {
        try {
            await this.loadConfigsFromDB();

            // Validate required configurations
            const missingRequired = [];
            for (const [key, config] of Object.entries(CONFIG_TYPES)) {
                if (config.required && !this.cache.has(key)) {
                    missingRequired.push(key);
                }
            }

            if (missingRequired.length > 0) {
                throw new Error(`[config] 缺少必要的配置: ${missingRequired.join(', ')}`);
            }

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error("[config] 初始化配置失败:", error);
            throw error;
        } finally {
            this.initializationPromise = null;
        }
    }

    async loadConfigsFromDB() {
        try {
            // Fetch all configurations from the database
            const configs = await prisma.ow_config.findMany();

            // Reset caches
            this.cache.clear();
            this.publicCache.clear();
            this.configInfo = configs || [];

            // First, load all configs marked as public in CONFIG_TYPES with their default values
            for (const [key, config] of Object.entries(CONFIG_TYPES)) {
                if (config.public) {
                    const defaultValue = getDefaultValue(key);
                    if (defaultValue !== undefined) {
                        this.cache.set(key, defaultValue);
                        this.publicCache.set(key, defaultValue);
                    }
                }
            }

            // Then populate caches with database values, overriding defaults if they exist
            if (Array.isArray(configs)) {
                for (const {key, value, is_public} of configs) {
                    try {
                        let parsedValue = value;
                        // For non-object types, use the value as is
                        if (CONFIG_TYPES[key] && CONFIG_TYPES[key].type !== 'object') {
                            // Validate and transform if we have type definition
                            parsedValue = validateConfig(key, parsedValue);
                        } else if (typeof value === 'string' && CONFIG_TYPES[key]?.type === 'object') {
                            // Only try JSON.parse for object type configs
                            try {
                                parsedValue = JSON.parse(value);
                            } catch {
                                logger.error(`[config] 解析JSON失败: ${key}`);
                            }
                        }

                        // Store in cache
                        this.cache.set(key, parsedValue);

                        // Store in public cache if marked as public in CONFIG_TYPES or database
                        if (is_public === true || CONFIG_TYPES[key]?.public === true) {
                            this.publicCache.set(key, parsedValue);
                        }
                    } catch (validationError) {
                        logger.error(`[config] 配置验证失败: ${key}:`, validationError);
                        // If validation fails, use default value if available
                        const defaultValue = getDefaultValue(key);
                        if (defaultValue !== undefined) {
                            this.cache.set(key, defaultValue);
                            if (is_public === true || CONFIG_TYPES[key]?.public === true) {
                                this.publicCache.set(key, defaultValue);
                            }
                        }
                    }
                }
            }

            return true;
        } catch (error) {
            logger.error("[config] 从数据库加载配置失败:", error);
            throw error;
        }
    }

    async get(key, defaultVal) {
        if (!key) {
            logger.warn("[config] 尝试获取配置时，key为空或未定义");
            return null;
        }

        // Ensure config is initialized
        await this.initialize();

        // Check cache first
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        try {
            const config = await prisma.ow_config.findFirst({where: {key}});
            let value = config?.value ?? null;

            // If value is null, try to get default value
            if (value === null) {
                value = defaultVal ?? getDefaultValue(key);
            }

            // For object type configs only, try to parse JSON
            if (typeof value === 'string' && CONFIG_TYPES[key]?.type === 'object') {
                try {
                    value = JSON.parse(value);
                } catch {
                    logger.error(`[config] 解析JSON失败: ${key}`);
                }
            }

            // Validate and transform if we have type definition
            if (CONFIG_TYPES[key] && value !== null) {
                try {
                    value = validateConfig(key, value);
                } catch (validationError) {
                    logger.error(`[config] 配置验证失败: ${key}:`, validationError);
                    value = defaultVal ?? getDefaultValue(key);
                }
            }

            // Update cache if value is not null
            if (value !== null) {
                this.cache.set(key, value);
            }

            return value;
        } catch (error) {
            logger.error(`[config] 获取配置失败: ${key}`, error);
            return defaultVal ?? getDefaultValue(key) ?? null;
        }
    }

    async set(key, value, isPublic = false) {
        if (!key) {
            throw new Error("[config] 设置配置时，key为空或未定义");
        }

        try {
            // Validate and transform if we have type definition
            let finalValue = value;
            if (CONFIG_TYPES[key]) {
                finalValue = validateConfig(key, value);
            }

            // Convert arrays to comma-separated strings and other values to strings
            let storageValue;
            if (Array.isArray(finalValue)) {
                storageValue = finalValue.join(',');
            } else if (typeof finalValue === 'object' && finalValue !== null) {
                storageValue = JSON.stringify(finalValue);
            } else {
                storageValue = String(finalValue);
            }

            // Update or create config in database
            await prisma.ow_config.upsert({
                where: {key},
                update: {value: storageValue,},
                create: {key, value: storageValue,}
            });

            // Update caches
            this.cache.set(key, finalValue);
            if (isPublic) {
                this.publicCache.set(key, finalValue);
            } else {
                this.publicCache.delete(key);
            }

            return true;
        } catch (error) {
            logger.error(`[config] 设置配置失败: ${key}`, error);
            throw error;
        }
    }

    getPublicConfigs() {
        return Object.fromEntries(this.publicCache);
    }
}

// Create a singleton instance
const zcconfigInstance = new ZCConfig();
export default zcconfigInstance;

