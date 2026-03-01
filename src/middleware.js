import expressWinston from 'express-winston';
import cors from 'cors';
import bodyParser from 'body-parser';
import compress from 'compression';
import cookieParser from 'cookie-parser';
import logger from './services/logger.js';
import zcconfig from './services/config/zcconfig.js';
import ipMiddleware from './middleware/ipMiddleware.js';

/**
 * 统一的令牌验证函数
 * 支持JWT令牌和账户令牌
 * @param {string} token 令牌字符串
 * @param {string} ipAddress IP地址
 * @returns {Promise<{valid: boolean, user: object|null, message: string, tokenType: string|null}>}
 */
async function verifyTokenUnified(token, ipAddress) {
    try {
        logger.debug(token);
        // 根据令牌前缀决定验证方式
        if (token.startsWith('zc_')) {
            // 验证账户令牌
            const accountTokenModule = await import('./services/auth/accountTokenService.js');
            const accountTokenResult = await accountTokenModule.verifyAccountToken(token);

            if (accountTokenResult.valid && accountTokenResult.user) {
                // 异步更新账户令牌使用记录
                accountTokenModule.updateAccountTokenUsage(accountTokenResult.user.token_id, ipAddress)
                    .catch(err => logger.error("更新账户令牌使用记录时出错:", err));

                return {
                    valid: true,
                    user: accountTokenResult.user,
                    message: "账户令牌验证成功",
                    tokenType: "account"
                };
            }

            return {
                valid: false,
                user: null,
                message: accountTokenResult.message || "账户令牌验证失败",
                tokenType: null
            };
        } else {
            // 验证JWT令牌
            const authModule = await import('./services/auth/auth.js');
            const authUtils = authModule.default;

            const jwtResult = await authUtils.verifyToken(token, ipAddress);

            if (jwtResult.valid && jwtResult.user) {
                return {
                    valid: true,
                    user: jwtResult.user,
                    message: "JWT令牌验证成功",
                    tokenType: "jwt"
                };
            }

            return {
                valid: false,
                user: null,
                message: jwtResult.message || "JWT令牌验证失败",
                tokenType: null
            };
        }
    } catch (error) {
        logger.error("统一令牌验证时出错:", error);
        return {
            valid: false,
            user: null,
            message: "令牌验证时发生错误",
            tokenType: null
        };
    }
}

/**
 * 配置Express应用的中间件
 * @param {express.Application} app Express应用实例
 */
export async function configureMiddleware(app) {
    // IP中间件 - 在所有其他中间件之前添加，以确保IP信息可用
    app.use(ipMiddleware);

    // 日志中间件 - 只记录HTTP请求，避免重复记录应用日志
    app.use(
        expressWinston.logger({
            winstonInstance: logger,
            meta: true,
            msg: "HTTP {{req.method}} {{res.statusCode}} {{res.responseTime}}ms {{req.url}} {{req.ipInfo.clientIP}}",
            colorize: false,
            ignoreRoute: (req, res) => false,
            level: "info",
            // 避免重复日志，只记录请求级别的元数据
            metaField: null, // 不要记录元数据的子对象
            expressFormat: false, // 不使用express默认格式避免重复
            dynamicMeta: (req, res) => {
                // 只记录必要的请求元数据，避免重复
                return {
                    reqId: req.id,
                    method: req.method,
                    url: req.url,
                    ip: req.ipInfo.clientIP
                };
            }
        })
    );

    // CORS配置
    const corslist = (await zcconfig.get("cors"));

    app.use(
        cors((req, callback) => {
            const origin = req.headers.origin;

            // /comment 和 /commentservice 路由对外提供 Waline API，允许任意来源
            if (req.path.startsWith('/comment')) {
                return callback(null, { origin: true, credentials: true });
            }

            // 无 origin (如服务端请求) 直接放行
            if (!origin) {
                return callback(null, { origin: true, credentials: true });
            }

            // 白名单放行
            try {
                if (corslist.includes(new URL(origin).hostname)) {
                    return callback(null, { origin: true, credentials: true });
                }
            } catch {}

            logger.error("CORS限制，请求来源：" + origin);
            return callback(new Error("CORS限制，请求来源可能存在风险"));
        })
    );

    // 请求体解析
    app.use(bodyParser.urlencoded({limit: "100mb", extended: false}));
    app.use(bodyParser.json({
        limit: "100mb",
        verify: (req, _res, buf) => {
            // 保留原始请求体字节，供 ActivityPub HTTP Signature / Digest 验证使用
            req.rawBody = buf;
        },
    }));
    app.use(bodyParser.text({limit: "100mb"}));
    app.use(bodyParser.raw({limit: "100mb"}));

    // 压缩中间件
    app.use(compress());

    // Cookie 解析中间件
    app.use(cookieParser());

    // 认证中间件 - 使用动态导入避免循环依赖
    app.use(async (req, res, next) => {
        // 尝试从多种来源获取token：
        // 1. Authorization header (Bearer token)
        // 2. Query parameter 'token'
        // 3. Cookie 'token'
        let token = null;

        // 检查Authorization header
        const authHeader = req.headers["authorization"];
        if (authHeader) {
            // 支持"Bearer token"格式或直接提供token
            const parts = authHeader.split(" ");
            if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
                token = parts[1];
            } else {
                token = authHeader;
            }
        }

        // 如果header中没有token，检查query参数
        if (!token && req.query.token) {
            token = req.query.token;
        }

        // 如果query中没有token，检查cookies
        if (!token && req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            // 没有令牌，继续处理请求但不设置用户信息
            return next();
        }

        try {
            // 使用统一的令牌验证函数
            const result = await verifyTokenUnified(token, req.ipInfo?.clientIP || req.ip);

            if (result.valid && result.user) {
                // 设置用户信息
                res.locals.userid = result.user.userid;
                res.locals.username = result.user.username;
                res.locals.display_name = result.user.display_name;
                res.locals.email = result.user.email;
                res.locals.tokenId = result.user.token_id;
                res.locals.tokenType = result.tokenType;
            } else {
                logger.debug(`令牌验证失败: ${result.message}`);
            }
        } catch (err) {
            logger.error("解析令牌时出错:", err);
        }

        next();
    });
}

/**
 * 从请求中提取token
 * @param {express.Request} req
 * @returns {string|null}
 */
export function extractTokenFromRequest(req) {
    let token = null;

    // 检查Authorization header
    const authHeader = req.headers["authorization"];
    if (authHeader) {
        // 支持"Bearer token"格式或直接提供token
        const parts = authHeader.split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
            token = parts[1];
        } else {
            token = authHeader;
        }
    }

    // 如果header中没有token，检查query参数
    if (!token && req.query.token) {
        token = req.query.token;
    }

    // 如果query中没有token，检查cookies
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    return token;
}

/**
 * Token验证中间件
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
export async function tokenAuthMiddleware(req, res, next) {
    const token = extractTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({
            status: "error",
            message: "未登录",
            code: "ZC_ERROR_NEED_LOGIN",
        });
    }

    try {
        // 使用统一的令牌验证函数
        const result = await verifyTokenUnified(token, req.ipInfo?.clientIP || req.ip);

        if (!result.valid || !result.user) {
            return res.status(401).json({
                status: "error",
                message: "未登录",
                code: "ZC_ERROR_NEED_LOGOUT",
            });
        }

        // 设置验证后的用户信息
        res.locals.tokeninfo = result.user;
        next();
    } catch (error) {
        logger.error("Token验证失败:", error);
        return res.status(401).json({
            status: "error",
            message: "Token验证失败",
            code: "ZC_ERROR_NEED_LOGOUT",
        });
    }
}