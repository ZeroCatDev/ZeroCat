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
    enum: (value, options) => {
        const strValue = String(value);
        if (!options || !Array.isArray(options) || !options.includes(strValue)) {
            return options?.[0] || "";
        }
        return strValue;
    },
};

// 基础配置类型定义
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
        default: 31536000,
        description: "刷新令牌有效期（秒），默认365天（1年）",
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
        public: true,
    },
    "redis.host": {
        type: "string",
        required: false,
        default: "localhost",
        description: "Redis服务器地址",
    },
    "sentry.dsn": {
        type: "string",
        required: false,
        default: "",
        description: "Sentry DSN 地址",
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
    "site.slogan": {
        type: "string",
        required: false,
        description: "站点标语",
        public: true,
    },
    "site.privacy": {
        type: "string",
        required: false,
        description: "隐私政策URL",
        public: true,
    },
    "site.tos": {
        type: "string",
        required: false,
        description: "服务条款URL",
        public: true,
    },
    // CodeRun Configuration
    "coderun.authtoken": {
        type: "string",
        required: false,
        description: "CodeRun设备注册认证令牌",
        default: Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15) + '请删掉这个后缀后保存',
        validate: (value) => value && value.length > 0,
    },
    "coderun.enabled": {
        type: "boolean",
        required: false,
        default: true,
        description: "是否启用CodeRun服务",
        transform: typeTransformers.boolean,
    },
    "coderun.pool_size": {
        type: "number",
        required: false,
        default: 5,
        description: "CodeRun容器池大小",
        transform: typeTransformers.number,
        validate: (value) => value >= 0 && value <= 100,
    },
    "coderun.report_interval": {
        type: "number",
        required: false,
        default: 60000,
        description: "CodeRun设备状态上报间隔（毫秒）",
        transform: typeTransformers.number,
        validate: (value) => value >= 5000 && value <= 3600000,
    },
    "captcha.GEE_API_SERVER": {
        type: "string",
        required: false,
        description: "极验验证API服务器地址",
    },
    "captcha.GEE_CAPTCHA_ID": {
        type: "string",
        required: false,
        description: "极验验证ID",
        public: true,
    },
    "captcha.GEE_CAPTCHA_KEY": {
        type: "string",
        required: false,
        description: "极验验证密钥",
    },
    "feedback.txcid": {
        type: "string",
        required: false,
        description: "腾讯兔小巢ID",
    },
    "feedback.txckey": {
        type: "string",
        required: false,
        description: "腾讯兔小巢密钥",
    },
    "oauth.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用OAuth登录",
        transform: typeTransformers.boolean,
        public: true,
    },
    "oauth.google.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用Google登录",
        transform: typeTransformers.boolean,
        public: true,
    },
    "oauth.google.client_id": {
        type: "string",
        required: false,
        description: "Google OAuth客户端ID",
    },
    "oauth.google.client_secret": {
        type: "string",
        required: false,
        description: "Google OAuth客户端密钥",
    },
    "oauth.microsoft.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用Microsoft登录",
        transform: typeTransformers.boolean,
        public: true,
    },
    "oauth.microsoft.client_id": {
        type: "string",
        required: false,
        description: "Microsoft OAuth客户端ID",
    },
    "oauth.microsoft.client_secret": {
        type: "string",
        required: false,
        description: "Microsoft OAuth客户端密钥",
    },
    "oauth.github.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用GitHub登录",
        transform: typeTransformers.boolean,
        public: true,
    },
    "oauth.github.client_id": {
        type: "string",
        required: false,
        description: "GitHub OAuth客户端ID",
    },
    "oauth.github.client_secret": {
        type: "string",
        required: false,
        description: "GitHub OAuth客户端密钥",
    },
    "oauth.40code.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用40code登录",
        transform: typeTransformers.boolean,
        public: true,
    },
    "oauth.40code.client_id": {
        type: "string",
        required: false,
        description: "40code OAuth客户端ID",
    },
    "oauth.40code.client_secret": {
        type: "string",
        required: false,
        description: "40code OAuth客户端密钥",
    },
    "oauth.linuxdo.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用Linux.do登录",
        transform: typeTransformers.boolean,
        public: true,
    },
    "oauth.linuxdo.client_id": {
        type: "string",
        required: false,
        description: "Linux.do OAuth客户端ID",
    },
    "oauth.linuxdo.client_secret": {
        type: "string",
        required: false,
        description: "Linux.do OAuth客户端密钥",
    },
    "oauth.twitter.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用Twitter登录",
        transform: typeTransformers.boolean,
        public: true,
    },
    "oauth.twitter.client_id": {
        type: "string",
        required: false,
        description: "Twitter OAuth客户端ID",
    },
    "oauth.twitter.client_secret": {
        type: "string",
        required: false,
        description: "Twitter OAuth客户端密钥",
    },
    "oauth.bluesky.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用Bluesky登录",
        transform: typeTransformers.boolean,
        public: true,
    },
    "oauth.bluesky.client_id": {
        type: "string",
        required: false,
        description: "Bluesky OAuth客户端ID（兼容字段，建议改用oauth.bluesky.client_metadata_url）",
    },
    "oauth.bluesky.client_name": {
        type: "string",
        required: false,
        description: "Bluesky OAuth client metadata中的client_name",
    },
    "oauth.bluesky.client_secret": {
        type: "string",
        required: false,
        description: "Bluesky OAuth客户端密钥",
    },
    "oauth.bluesky.default_pds": {
        type: "string",
        required: false,
        default: "https://bsky.social",
        description: "Bluesky默认PDS地址",
        validate: (value) => value.startsWith("http://") || value.startsWith("https://"),
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
    "sitemap.enabled": {
        type: "boolean",
        required: false,
        default: true,
        description: "是否启用站点地图功能",
        transform: typeTransformers.boolean,
    },
    "sitemap.auto_update": {
        type: "boolean",
        required: false,
        default: true,
        description: "是否启用自动更新站点地图",
        transform: typeTransformers.boolean,
    },
    "sitemap.update_cron": {
        type: "string",
        required: false,
        default: "0 0 * * *", // 每天凌晨执行
        description: "站点地图自动更新的cron表达式",
        validate: (value) => /^(\S+ ){4}\S+$/.test(value), // 简单验证cron格式
    },
    "sitemap.current_file_hash": {
        type: "string",
        required: false,
        description: "当前站点地图文件的SHA256哈希值",
    },
    "sitemap.last_full_update": {
        type: "string",
        required: false,
        description: "最后一次全量更新时间",
    },
    "sitemap.last_incremental_update": {
        type: "string",
        required: false,
        description: "最后一次增量更新时间",
    },
    "search.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用搜索功能",
        transform: typeTransformers.boolean,
        public: true,
    },
    "search.meilisearch.url": {
        type: "string",
        required: false,
        description: "Meilisearch服务器地址",
        public: true,
    },
    "search.meilisearch.api_key": {
        type: "string",
        required: false,
        description: "Meilisearch API密钥",
        public: true,
    },
    "search.meilisearch.index_name": {
        type: "string",
        required: false,
        description: "Meilisearch索引名称",
        public: true,
    },
    "scratchproxy.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用ScratchProxy",
        transform: typeTransformers.boolean,
        public: true,
    },
    "scratchproxy.url": {
        type: "string",
        required: false,
        description: "ScratchProxy服务器地址",
        public: true,
        validate: (value) => value.startsWith("http://") || value.startsWith("https://"),
    },
    "scratchproxy.gui": {
        type: "string",
        required: false,
        description: "ScratchProxy GUI地址",
        public: true,
        validate: (value) => value.startsWith("http://") || value.startsWith("https://"),
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
    "webpush.vapid_public_key": {
        type: "string",
        required: false,
        description: "Web Push VAPID公钥",
        public: true,
    },
    "webpush.vapid_private_key": {
        type: "string",
        required: false,
        description: "Web Push VAPID私钥",
        public: false,
    },
    "webpush.vapid_subject": {
        type: "string",
        required: false,
        description: "Web Push VAPID主题",
        public: true,
    },
    "webauthn.rpId": {
        type: "string",
        required: false,
        description: "WebAuthn RP ID",
        public: true,
    },
    "webauthn.rpName": {
        type: "string",
        required: false,
        description: "WebAuthn RP Name",
        public: true,
    },
    "webauthn.origins": {
        type: "array",
        required: false,
        description: "WebAuthn RP Origins",
        public: true,
    },
    // BullMQ Configuration
    "bullmq.enabled": {
        type: "boolean",
        required: false,
        default: true,
        description: "是否启用BullMQ任务队列",
        transform: typeTransformers.boolean,
    },
    "bullmq.redis.db": {
        type: "number",
        required: false,
        default: 0,
        description: "BullMQ使用的Redis数据库编号",
        transform: typeTransformers.number,
        validate: (value) => value >= 0 && value <= 15,
    },
    "bullmq.email.concurrency": {
        type: "number",
        required: false,
        default: 3,
        description: "邮件Worker并发数",
        transform: typeTransformers.number,
        validate: (value) => value > 0 && value <= 20,
    },
    "bullmq.email.maxRetries": {
        type: "number",
        required: false,
        default: 3,
        description: "邮件失败最大重试次数",
        transform: typeTransformers.number,
        validate: (value) => value >= 0 && value <= 10,
    },
    "bullmq.email.retryDelay": {
        type: "number",
        required: false,
        default: 60000,
        description: "邮件重试基础延迟(ms)",
        transform: typeTransformers.number,
        validate: (value) => value >= 1000,
    },
    "bullmq.dashboard.enabled": {
        type: "boolean",
        required: false,
        default: true,
        description: "是否启用BullMQ仪表板",
        transform: typeTransformers.boolean,
    },
    // Comment Service Configuration
    "commentservice.akismet.keys": {
        type: "array",
        required: false,
        default: [],
        description: "Akismet API 密钥池",
        transform: typeTransformers.array,
    },
    "commentservice.sensitive_words": {
        type: "json",
        required: false,
        default: [],
        description: "全局敏感词列表（字符串数组）",
    },
    "commentservice.sensitive_ban_duration": {
        type: "number",
        required: false,
        default: 3600,
        description: "敏感词触发后IP封禁时长（秒）",
        transform: typeTransformers.number,
        validate: (value) => value > 0,
    },
    // 海外代理配置
    "proxy.url": {
        type: "string",
        required: false,
        description: "HTTP/HTTPS代理URL (例如: http://proxy.example.com:8080 或 http://user:pass@proxy.example.com:8080)",
        validate: (value) => !value || value.startsWith('http://') || value.startsWith('https://'),
    },
    "oauth.proxy.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否为OAuth请求启用代理",
        transform: typeTransformers.boolean,
    },
    // ActivityPub 联邦协议配置
    "ap.federation.enabled": {
        type: "boolean",
        required: false,
        default: false,
        description: "是否启用ActivityPub联邦协议，启用后本站内容可被其他Fediverse实例发现和订阅",
        transform: typeTransformers.boolean,
        public: true,
    },
    "ap.auto_accept_follows": {
        type: "boolean",
        required: false,
        default: true,
        description: "是否自动接受来自远程实例的关注请求",
        transform: typeTransformers.boolean,
    },
    "ap.instance.domain": {
        type: "string",
        required: false,
        description: "ActivityPub实例域名，留空则从urls.api自动推断。一旦启用联邦后不应更改",
        validate: (value) => !value || /^[a-zA-Z0-9.-]+(:\d+)?$/.test(value),
        public: true,
    },
    "ap.instance.name": {
        type: "string",
        required: false,
        default: "ZeroCat",
        description: "ActivityPub实例显示名称，在NodeInfo和Actor中展示",
        public: true,
    },
    "ap.instance.description": {
        type: "string",
        required: false,
        default: "",
        description: "ActivityPub实例描述信息",
        public: true,
    },
    "ap.instance.public_key": {
        type: "string",
        required: false,
        description: "ActivityPub实例RSA公钥(PEM格式)，用于HTTP Signature验证，自动生成",
    },
    "ap.instance.private_key": {
        type: "string",
        required: false,
        description: "ActivityPub实例RSA私钥(PEM格式)，用于HTTP Signature签名，自动生成",
    },
};

// 从数据库加载的动态配置
export let DYNAMIC_CONFIG_TYPES = {};

// 合并静态和动态配置
export function getMergedConfigTypes() {
    return {...CONFIG_TYPES, ...DYNAMIC_CONFIG_TYPES};
}

// 更新动态配置类型
export function updateDynamicConfigTypes(dbConfigs) {
    DYNAMIC_CONFIG_TYPES = {};
    for (const config of dbConfigs) {
        const metadata = config.metadata || {};
        DYNAMIC_CONFIG_TYPES[config.key] = {
            type: config.type.toLowerCase(),
            required: metadata.required || false,
            default: metadata.default,
            description: metadata.description || "",
            public: metadata.public || false,
            fromDatabase: true,
            options: metadata.options, // 用于enum类型
            validate: metadata.validate ? new Function("value", metadata.validate) : null,
        };
    }
}

// Validation functions
export function validateConfig(key, value) {
    const allTypes = getMergedConfigTypes();
    const configType = allTypes[key];
    if (!configType) {
        throw new Error(`Unknown configuration key: ${key}`);
    }

    // Transform value if transform function exists
    let transformedValue = value;
    if (configType.transform) {
        transformedValue = configType.transform(value);
    } else if (typeTransformers[configType.type]) {
        transformedValue = configType.type === "enum"
            ? typeTransformers[configType.type](value, configType.options)
            : typeTransformers[configType.type](value);
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
    const allTypes = getMergedConfigTypes();
    const configType = allTypes[key];
    if (!configType) return undefined;

    const defaultValue = configType.default;
    if (defaultValue === undefined) return undefined;

    // Transform default value if needed
    if (configType.transform) {
        return configType.transform(defaultValue);
    } else if (typeTransformers[configType.type]) {
        return configType.type === "enum"
            ? typeTransformers[configType.type](defaultValue, configType.options)
            : typeTransformers[configType.type](defaultValue);
    }
    return defaultValue;
}

// Check if a config key is required
export function isRequired(key) {
    const allTypes = getMergedConfigTypes();
    return allTypes[key]?.required ?? false;
}

// Get all configs that need special handling
export function getSpecialConfigs() {
    const allTypes = getMergedConfigTypes();
    return Object.entries(allTypes)
        .filter(([_, config]) => config.special)
        .map(([key, config]) => ({
            key,
            description: config.description,
            required: config.required,
        }));
}

// 获取所有配置类型定义
export function getAllConfigTypes() {
    const allTypes = getMergedConfigTypes();
    return Object.entries(allTypes).map(([key, config]) => ({
        key,
        type: config.type,
        required: config.required,
        default: config.default,
        description: config.description,
        public: config.public,
        fromDatabase: config.fromDatabase || false,
        options: config.options,
    }));
}

// 验证配置类型定义是否有效
export function validateConfigType(type, metadata) {
    if (!typeTransformers[type]) {
        throw new Error(`Unsupported config type: ${type}`);
    }

    if (type === "enum" && (!metadata.options || !Array.isArray(metadata.options) || metadata.options.length === 0)) {
        throw new Error("Enum type requires non-empty options array in metadata");
    }

    if (metadata.validate && typeof metadata.validate !== "string") {
        throw new Error("Validate function must be a string");
    }

    return true;
}
