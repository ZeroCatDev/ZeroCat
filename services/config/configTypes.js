// Configuration type definitions and validation rules

// 特殊类型转换函数
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
  select: (value) => {
    if (value == null) return "";
    return String(value);
  },
};

/**
 * 配置说明：
 * @special - 标记需要特殊处理的配置
 * @transform - 自定义转换函数
 * @comment - 使用说明
 */
export const CONFIG_TYPES = {
  "urls.frontend": {
    type: "string",
    required: true,
    default: "http://localhost:3141",
    description: "前端应用URL地址，用于生成各类跳转链接",
    validate: (value) =>
      value.startsWith("http://") || value.startsWith("https://"),
    public: true,
  },
  "urls.backend": {
    type: "string",
    required: true,
    default: "http://localhost:3000",
    description: "后端API服务URL地址，用于生成API回调地址",
    validate: (value) =>
      value.startsWith("http://") || value.startsWith("https://"),
    public: true,
  },
  "security.jwttoken": {
    type: "string",
    required: true,
    description: "JWT签名密钥，用于生成和验证JWT令牌，应用启动时生成",
    default:
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15),
    validate: (value) => value && value.length > 0,
  },
  "security.adminusers": {
    type: "array",
    required: false,
    default: [1],
    description: "管理员用户列表，用于权限控制，支持邮箱或用户ID",
    transform: (value) => {
      const arr = typeTransformers.array(value);
      return arr.map((v) => (typeof v === "string" ? v.toLowerCase() : v));
    },
  },
  "security.accessTokenExpiry": {
    type: "number",
    required: false,
    default: 900,
    description: "访问令牌有效期（秒），默认15分钟",
    transform: typeTransformers.number,
    validate: (value) => value > 0,
  },
  "security.refreshTokenExpiry": {
    type: "number",
    required: false,
    default: 2592000,
    description: "刷新令牌有效期（秒），默认30天",
    transform: typeTransformers.number,
    validate: (value) => value > 0,
  },
  "security.refreshTokenExtensionEnabled": {
    type: "boolean",
    required: false,
    default: false,
    description: "是否启用刷新令牌延期功能",
    transform: typeTransformers.boolean,
  },
  "security.refreshTokenMaxExtensionDays": {
    type: "number",
    required: false,
    default: 90,
    description: "刷新令牌最大延期天数",
    transform: typeTransformers.number,
    validate: (value) => value > 0,
  },
  "s3.endpoint": {
    type: "string",
    required: true,
    description: "S3存储服务端点地址",
  },
  "s3.region": {
    type: "string",
    required: true,
    description: "S3存储服务区域",
  },
  "s3.AWS_ACCESS_KEY_ID": {
    type: "string",
    required: true,
    description: "S3访问密钥ID",
  },
  "s3.AWS_SECRET_ACCESS_KEY": {
    type: "string",
    required: true,
    description: "S3访问密钥密文",
  },
  "s3.bucket": {
    type: "string",
    required: true,
    description: "S3存储桶名称",
  },
  "s3.staticurl": {
    type: "string",
    required: true,
    description: "S3静态资源访问URL前缀",
  },
  "redis.host": {
    type: "string",
    required: false,
    default: "localhost",
    description: "Redis服务器地址",
  },
  "redis.port": {
    type: "number",
    required: false,
    default: 6379,
    description: "Redis服务器端口",
    transform: typeTransformers.number,
    validate: (value) => value > 0 && value < 65536,
  },
  "redis.password": {
    type: "string",
    required: false,
    default: "",
    description: "Redis服务器密码",
  },
  "mail.enabled": {
    type: "boolean",
    required: false,
    default: false,
    description: "是否启用邮件功能",
    transform: typeTransformers.boolean,
  },
  "mail.host": {
    type: "string",
    required: false,
    description: "SMTP服务器地址，例如: smtp.gmail.com",
    validate: (value) => value && value.length > 0,
  },
  "mail.port": {
    type: "number",
    required: false,
    default: 587,
    description: "SMTP服务器端口，常用端口: 25, 465(SSL), 587(TLS)",
    transform: typeTransformers.number,
    validate: (value) => value > 0 && value < 65536,
  },
  "mail.secure": {
    type: "boolean",
    required: false,
    default: true,
    description: "是否使用SSL/TLS加密连接",
    transform: typeTransformers.boolean,
  },
  "mail.auth.user": {
    type: "string",
    required: false,
    description: "SMTP服务器登录用户名/邮箱地址",
    validate: (value) => value && value.length > 0,
  },
  "mail.auth.pass": {
    type: "string",
    required: false,
    description: "SMTP服务器登录密码或应用专用密码",
    validate: (value) => value && value.length > 0,
  },
  "mail.from_name": {
    type: "string",
    required: false,
    description: "发件人名称",
    validate: (value) => value && value.length > 0,
  },
  "mail.from_address": {
    type: "string",
    required: false,
    description: "发件人地址",
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  },
  "site.name": {
    type: "string",
    required: true,
    description: "站点名称，用于显示和邮件模板",
    public: true,
  },
  "site.domain": {
    type: "string",
    required: true,
    description: "站点域名，用于生成链接和验证",
    public: true,
  },
  "site.email": {
    type: "string",
    required: true,
    description: "站点联系邮箱",
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    public: true,
  },
  "maxmind.enabled": {
    type: "boolean",
    required: false,
    default: false,
    description: "是否启用MaxMind地理位置服务",
    transform: typeTransformers.boolean,
  },
  "maxmind.license_key": {
    type: "string",
    required: false,
    description: "MaxMind服务授权密钥",
  },
  "maxmind.account_id": {
    type: "string",
    required: false,
    description: "MaxMind账户ID",
    transform: (value) => value?.toString(),
  },
  cors: {
    type: "array",
    required: true,
    default: ["*"],
    description: "CORS跨域配置，支持*或具体域名列表（逗号分隔）",
    transform: (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        if (value === "*") return ["*"];
        return value
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
      }
      return ["*"];
    },
    public: true,
  },
};

// Validation functions
export function validateConfig(key, value) {
  const configType = CONFIG_TYPES[key];
  if (!configType) {
    throw new Error(`Unknown configuration key: ${key}`);
  }

  // Transform value if transform function exists
  let transformedValue = value;
  if (configType.transform) {
    transformedValue = configType.transform(value);
  } else if (typeTransformers[configType.type]) {
    transformedValue = typeTransformers[configType.type](value);
  }

  // Handle null/undefined for non-required fields
  if (transformedValue == null && !configType.required) {
    return configType.default ?? null;
  }

  // Run custom validation if exists
  if (configType.validate && !configType.validate(transformedValue)) {
    throw new Error(`Validation failed for ${key}`);
  }

  return transformedValue;
}

// Get default value for a config key
export function getDefaultValue(key) {
  const configType = CONFIG_TYPES[key];
  if (!configType) return undefined;

  const defaultValue = configType.default;
  if (defaultValue === undefined) return undefined;

  // Transform default value if needed
  if (configType.transform) {
    return configType.transform(defaultValue);
  } else if (typeTransformers[configType.type]) {
    return typeTransformers[configType.type](defaultValue);
  }
  return defaultValue;
}

// Check if a config key is required
export function isRequired(key) {
  return CONFIG_TYPES[key]?.required ?? false;
}

// Get all configs that need special handling
export function getSpecialConfigs() {
  return Object.entries(CONFIG_TYPES)
    .filter(([_, config]) => config.special)
    .map(([key, config]) => ({
      key,
      description: config.description,
      required: config.required,
    }));
}
