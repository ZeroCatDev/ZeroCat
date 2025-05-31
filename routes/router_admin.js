import { Router } from "express";
import { needAdmin } from "../middleware/auth.js";
import logger from "../services/logger.js";
import zcconfig from "../services/config/zcconfig.js";
import { CONFIG_TYPES, getDefaultValue } from "../services/config/configTypes.js";

const router = Router();

/**
 * Admin Router
 * 管理后台路由模块，包含：
 * 1. 配置管理
 * 2. 用户管理（待实现）
 * 3. 内容管理（待实现）
 * 4. 系统监控（待实现）
 * 5. 日志查看（待实现）
 */

// ==================== 配置管理路由 ====================

/**
 * @api {get} /admin/config/list 获取所有配置项
 * @apiName GetConfigList
 * @apiGroup AdminConfig
 * @apiPermission admin
 *
 * @apiSuccess {String} status 请求状态
 * @apiSuccess {Object[]} data 配置项列表
 * @apiSuccess {String} data.key 配置键名
 * @apiSuccess {String} data.type 配置类型
 * @apiSuccess {Boolean} data.required 是否必填
 * @apiSuccess {*} data.default 默认值
 * @apiSuccess {String} data.description 配置说明
 * @apiSuccess {*} data.current_value 当前值
 * @apiSuccess {Boolean} data.is_modified 是否被修改过
 */
router.get("/config/list", needAdmin, async (req, res) => {
  try {
    const configList = [];

    for (const [key, config] of Object.entries(CONFIG_TYPES)) {
      const currentValue = await zcconfig.get(key);
      const defaultValue = getDefaultValue(key);

      configList.push({
        key,
        type: config.type,
        required: config.required,
        default: defaultValue,
        description: config.description,
        current_value: currentValue,
        is_modified: JSON.stringify(currentValue) !== JSON.stringify(defaultValue),
        options: config.options, // 对于select类型的配置
        allowCustomValue: config.type === 'select' ? !!config.allowCustomValue : undefined // 是否允许自定义值
      });
    }

    res.json({
      status: "success",
      data: configList
    });
  } catch (error) {
    logger.error("获取配置列表失败:", error);
    res.status(500).json({
      status: "error",
      message: "获取配置列表失败",
      error: error.message
    });
  }
});

/**
 * @api {get} /admin/config/:key 获取单个配置项详情
 * @apiName GetConfigDetail
 * @apiGroup AdminConfig
 * @apiPermission admin
 *
 * @apiParam {String} key 配置键名
 *
 * @apiSuccess {String} status 请求状态
 * @apiSuccess {Object} data 配置项详情
 */
router.get("/config/:key", needAdmin, async (req, res) => {
  try {
    const { key } = req.params;

    if (!CONFIG_TYPES[key]) {
      return res.status(404).json({
        status: "error",
        message: "配置项不存在"
      });
    }

    const config = CONFIG_TYPES[key];
    const currentValue = await zcconfig.get(key);
    const defaultValue = getDefaultValue(key);

    res.json({
      status: "success",
      data: {
        key,
        type: config.type,
        required: config.required,
        default: defaultValue,
        description: config.description,
        current_value: currentValue,
        is_modified: JSON.stringify(currentValue) !== JSON.stringify(defaultValue),
        options: config.options,
        allowCustomValue: config.type === 'select' ? !!config.allowCustomValue : undefined
      }
    });
  } catch (error) {
    logger.error(`获取配置项 ${req.params.key} 失败:`, error);
    res.status(500).json({
      status: "error",
      message: "获取配置项失败",
      error: error.message
    });
  }
});

/**
 * @api {put} /admin/config/:key 更新配置项
 * @apiName UpdateConfig
 * @apiGroup AdminConfig
 * @apiPermission admin
 *
 * @apiParam {String} key 配置键名
 * @apiParam {*} value 配置值
 *
 * @apiSuccess {String} status 请求状态
 * @apiSuccess {Object} data 更新后的配置项或验证失败信息
 * @apiSuccess {Boolean} data.valid 验证是否通过
 * @apiSuccess {String} [data.error] 验证失败时的错误信息
 * @apiSuccess {*} [data.value] 验证通过时的更新后的值
 * @apiSuccess {Boolean} [data.is_modified] 验证通过时是否被修改
 */
router.put("/config/:key", needAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!CONFIG_TYPES[key]) {
      return res.status(404).json({
        status: "error",
        message: "配置项不存在"
      });
    }

    const config = CONFIG_TYPES[key];
    let transformedValue = value;

    try {
      // 尝试转换值
      if (config.transform) {
        transformedValue = config.transform(value);
      }
      console.log(transformedValue);
      // 特殊处理select类型的验证
      if (config.type === 'select') {
        if (typeof transformedValue !== 'string') {
          return res.json({
            status: "success",
            data: {
              valid: false,
              error: `Invalid type for ${key}. Expected string, got ${typeof transformedValue}`
            }
          });
        }

        // 检查值是否在选项列表中，或者是否允许自定义值
        if (!config.options.includes(transformedValue) && !(config.allowCustomValue === true)) {
          return res.json({
            status: "success",
            data: {
              valid: false,
              error: `Invalid value for ${key}. Must be one of: ${config.options.join(', ')}`
            }
          });
        }
      }
      // 其他类型的验证
      else if (config.validate && !config.validate(transformedValue)) {
        return res.json({
          status: "success",
          data: {
            valid: false,
            error: "配置值验证失败"
          }
        });
      }

      // 验证通过，保存配置
      await zcconfig.set(key, transformedValue);
      const updatedValue = await zcconfig.get(key);
      const defaultValue = getDefaultValue(key);

      res.json({
        status: "success",
        data: {
          valid: true,
          key,
          value: updatedValue,
          is_modified: JSON.stringify(updatedValue) !== JSON.stringify(defaultValue)
        }
      });
    } catch (error) {
      res.json({
        status: "success",
        data: {
          valid: false,
          error: error.message
        }
      });
    }
  } catch (error) {
    logger.error(`更新配置项 ${req.params.key} 失败:`, error);
    res.status(500).json({
      status: "error",
      message: "更新配置项失败",
      error: error.message
    });
  }
});

/**
 * @api {post} /admin/config/:key/reset 重置配置项为默认值
 * @apiName ResetConfig
 * @apiGroup AdminConfig
 * @apiPermission admin
 *
 * @apiParam {String} key 配置键名
 *
 * @apiSuccess {String} status 请求状态
 * @apiSuccess {Object} data 重置后的配置项
 */
router.post("/config/:key/reset", needAdmin, async (req, res) => {
  try {
    const { key } = req.params;

    if (!CONFIG_TYPES[key]) {
      return res.status(404).json({
        status: "error",
        message: "配置项不存在"
      });
    }

    const defaultValue = getDefaultValue(key);
    await zcconfig.set(key, defaultValue);

    res.json({
      status: "success",
      data: {
        key,
        value: defaultValue,
        is_modified: false
      }
    });
  } catch (error) {
    logger.error(`重置配置项 ${req.params.key} 失败:`, error);
    res.status(500).json({
      status: "error",
      message: "重置配置项失败",
      error: error.message
    });
  }
});

/**
 * @api {get} /admin/config/check/modified 检查已修改的配置项
 * @apiName CheckModifiedConfigs
 * @apiGroup AdminConfig
 * @apiPermission admin
 *
 * @apiSuccess {String} status 请求状态
 * @apiSuccess {Object[]} data 已修改的配置项列表
 */
router.get("/config/check/modified", needAdmin, async (req, res) => {
  try {
    const modifiedConfigs = [];

    for (const [key, config] of Object.entries(CONFIG_TYPES)) {
      const currentValue = await zcconfig.get(key);
      const defaultValue = getDefaultValue(key);

      if (JSON.stringify(currentValue) !== JSON.stringify(defaultValue)) {
        modifiedConfigs.push({
          key,
          type: config.type,
          description: config.description,
          default: defaultValue,
          current_value: currentValue
        });
      }
    }

    res.json({
      status: "success",
      data: modifiedConfigs
    });
  } catch (error) {
    logger.error("检查修改配置失败:", error);
    res.status(500).json({
      status: "error",
      message: "检查修改配置失败",
      error: error.message
    });
  }
});

/**
 * @api {post} /admin/config/batch/reset 批量重置配置项
 * @apiName BatchResetConfigs
 * @apiGroup AdminConfig
 * @apiPermission admin
 *
 * @apiParam {String[]} keys 要重置的配置键名列表
 *
 * @apiSuccess {String} status 请求状态
 * @apiSuccess {Object} data 重置结果
 * @apiSuccess {Object[]} data.success 重置成功的配置项
 * @apiSuccess {Object[]} data.failed 重置失败的配置项
 */
router.post("/config/batch/reset", needAdmin, async (req, res) => {
  try {
    const { keys } = req.body;

    if (!Array.isArray(keys)) {
      return res.status(400).json({
        status: "error",
        message: "keys必须是数组"
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const key of keys) {
      try {
        if (!CONFIG_TYPES[key]) {
          results.failed.push({
            key,
            error: "配置项不存在"
          });
          continue;
        }

        const config = CONFIG_TYPES[key];
        const defaultValue = getDefaultValue(key);

        // 验证默认值
        let transformedValue = defaultValue;
        if (config.transform) {
          transformedValue = config.transform(defaultValue);
        }

        if (config.validate && !config.validate(transformedValue)) {
          results.failed.push({
            key,
            error: "默认值验证失败",
            default_value: defaultValue
          });
          continue;
        }

        await zcconfig.set(key, transformedValue);
        results.success.push({
          key,
          value: transformedValue
        });
      } catch (error) {
        results.failed.push({
          key,
          error: error.message,
          default_value: getDefaultValue(key)
        });
      }
    }

    res.json({
      status: "success",
      data: results
    });
  } catch (error) {
    logger.error("批量重置配置失败:", error);
    res.status(500).json({
      status: "error",
      message: "批量重置配置失败",
      error: error.message
    });
  }
});

/**
 * @api {post} /admin/config/validate 验证配置值
 * @apiName ValidateConfig
 * @apiGroup AdminConfig
 * @apiPermission admin
 *
 * @apiParam {String} key 配置键名
 * @apiParam {*} value 要验证的值
 *
 * @apiSuccess {String} status 请求状态
 * @apiSuccess {Object} data 验证结果
 */
router.post("/config/validate", needAdmin, async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!CONFIG_TYPES[key]) {
      return res.status(404).json({
        status: "error",
        message: "配置项不存在"
      });
    }

    try {
      // 尝试验证值但不保存
      const config = CONFIG_TYPES[key];
      let transformedValue = value;

      if (config.transform) {
        transformedValue = config.transform(value);
      }

      if (config.validate && !config.validate(transformedValue)) {
        throw new Error("验证失败");
      }

      res.json({
        status: "success",
        data: {
          valid: true,
          transformed_value: transformedValue
        }
      });
    } catch (error) {
      res.json({
        status: "success",
        data: {
          valid: false,
          error: error.message
        }
      });
    }
  } catch (error) {
    logger.error("验证配置值失败:", error);
    res.status(500).json({
      status: "error",
      message: "验证配置值失败",
      error: error.message
    });
  }
});

// ==================== 系统信息路由 ====================

/**
 * @api {get} /admin/system/info 获取系统信息
 * @apiName GetSystemInfo
 * @apiGroup AdminSystem
 * @apiPermission admin
 *
 * @apiSuccess {String} status 请求状态
 * @apiSuccess {Object} data 系统信息
 */
router.get("/system/info", needAdmin, async (req, res) => {
  try {
    const systemInfo = {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage(),
    };

    res.json({
      status: "success",
      data: systemInfo
    });
  } catch (error) {
    logger.error("获取系统信息失败:", error);
    res.status(500).json({
      status: "error",
      message: "获取系统信息失败",
      error: error.message
    });
  }
});

// ==================== 用户管理路由 ====================
// TODO: 实现用户管理相关接口

// ==================== 内容管理路由 ====================
// TODO: 实现内容管理相关接口

// ==================== 系统监控路由 ====================
// TODO: 实现系统监控相关接口

// ==================== 日志查看路由 ====================
// TODO: 实现日志查看相关接口

export default router;