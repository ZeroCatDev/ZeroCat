import {Router} from "express";
import {CONFIG_TYPES, getDefaultValue} from "../../services/config/configTypes.js";
import {needAdmin} from "../../middleware/auth.js";
import zcconfig from "../../services/config/zcconfig.js";
import logger from "../../services/logger.js";

const router = Router();

// 类型转换函数
const typeTransformers = {
    array: (value) => {
        if (Array.isArray(value)) return value;
        return String(value)
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
    },
    boolean: (value) => {
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
            return value.toLowerCase() === "true" || value === "1";
        }
        if (typeof value === "number") {
            return value === 1;
        }
        return false;
    },
    number: (value) => {
        if (typeof value === "number") return value;
        if (typeof value === "string") {
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    },
    string: (value) => {
        if (value == null) return "";
        return String(value);
    },
    enum: (value, options) => {
        const strValue = String(value);
        if (!options || !Array.isArray(options) || !options.includes(strValue)) {
            return options?.[0] || "";
        }
        return strValue;
    },
    object: (value) => {
        if (typeof value === 'object' && value !== null) return value;
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
};

// 解析配置值
function parseConfigValue(value, type, options) {
    if (value === null || value === undefined) {
        return null;
    }

    const transformer = typeTransformers[type.toLowerCase()];
    if (!transformer) {
        logger.error(`未知的配置类型: ${type}`);
        return value;
    }

    try {
        return transformer(value, options);
    } catch (error) {
        logger.error(`解析配置值失败: ${error.message}`);
        return null;
    }
}

// 获取统一的配置接口（包含类型和值）
router.get("/unified", needAdmin, async (req, res) => {
    try {
        // 获取所有系统配置
        const configPromises = Object.entries(CONFIG_TYPES).map(async ([key, config]) => {
            const currentValue = await zcconfig.get(key);
            const defaultValue = getDefaultValue(key);

            // 确保当前值不为null，如果为null则使用默认值
            const finalValue = currentValue === null ? defaultValue : currentValue;

            return {
                key,
                type: config.type,
                required: config.required,
                default: defaultValue,
                description: config.description,
                public: config.public || false,
                options: config.options,
                value: finalValue,
                is_modified: JSON.stringify(finalValue) !== JSON.stringify(defaultValue)
            };
        });

        // 等待所有配置的异步操作完成
        const configs = await Promise.all(configPromises);

        // 按key排序
        configs.sort((a, b) => a.key.localeCompare(b.key));

        res.json({configs});
    } catch (error) {
        logger.error("获取配置失败:", error);
        res.status(500).json({error: error.message});
    }
});

// 更新配置项
router.put("/:key", needAdmin, async (req, res) => {
    const {key} = req.params;
    const {value} = req.body;

    try {
        // 检查配置是否存在
        const configType = CONFIG_TYPES[key];
        if (!configType) {
            return res.status(404).json({error: "Configuration not found"});
        }

        // 更新配置值
        await zcconfig.set(key, value);
        const updatedValue = await zcconfig.get(key);
        const defaultValue = getDefaultValue(key);

        res.json({
            config: {
                key,
                value: updatedValue,
                type: configType.type,
                default: defaultValue,
                is_modified: JSON.stringify(updatedValue) !== JSON.stringify(defaultValue)
            }
        });
    } catch (error) {
        logger.error("更新配置失败:", error);
        res.status(400).json({error: error.message});
    }
});

// 重置配置项到默认值
router.post("/:key/reset", needAdmin, async (req, res) => {
    const {key} = req.params;

    try {
        // 检查配置是否存在
        if (!CONFIG_TYPES[key]) {
            return res.status(404).json({error: "Configuration not found"});
        }

        const defaultValue = getDefaultValue(key);
        await zcconfig.set(key, defaultValue);

        res.json({
            config: {
                key,
                value: defaultValue,
                is_modified: false
            }
        });
    } catch (error) {
        logger.error("重置配置失败:", error);
        res.status(400).json({error: error.message});
    }
});

export default router;