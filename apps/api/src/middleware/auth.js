import zcconfig from "../services/config/zcconfig.js";
import logger from "../services/logger.js";
import { verifyToken } from "../services/auth/tokenService.js";
import { scopeSatisfies } from "../services/auth/scopes.js";
import { assignRoleToUser, SYSTEM_ROLE_KEYS, userSatisfiesPolicy } from "../services/auth/policyEngine.js";
import { extractTokenFromRequest } from "../middleware.js";

/**
 * 解析token中间件 (可选认证)
 *
 * 注意: 全局认证中间件 (middleware.js configureMiddleware) 已在所有路由之前
 * 解析并验证令牌, 设置 res.locals.userid / scopes 等。此中间件作为兜底:
 * 若 res.locals.userid 尚未设置, 再尝试解析一次, 以兼容独立挂载场景。
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const parseToken = async (req, res, next) => {
    if (res.locals.userid) {
        return next();
    }

    const token = extractTokenFromRequest(req);
    if (!token) {
        return next();
    }

    try {
        const result = await verifyToken(token, req.ipInfo?.clientIP || req.ip);
        if (result.valid && result.user) {
            res.locals.userid = result.user.userid;
            res.locals.username = result.user.username;
            res.locals.display_name = result.user.display_name;
            res.locals.email = result.user.email;
            res.locals.tokenId = result.user.token_id;
            res.locals.tokenType = result.tokenType;
            res.locals.scopes = result.scopes || [];
            res.locals.applicationId = result.applicationId || null;
        } else {
            logger.debug(`令牌验证失败: ${result.message}`);
        }
    } catch (err) {
        logger.debug("解析令牌时出错:", err);
    }

    next();
};

/**
 * 严格模式token中间件
 * 确保用户已登录且令牌有效。全局中间件已完成验证, 这里检查结果。
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const strictTokenCheck = async (req, res, next) => {
    if (!res.locals.userid || !res.locals.tokenId) {
        return res.status(401).json({
            status: "error",
            message: "未提供有效的授权令牌",
            code: "ZC_ERROR_NEED_LOGIN",
        });
    }
    next();
};

/**
 * 需要登录的中间件
 * 全局中间件已验证令牌有效性, 这里只需检查是否登录。
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const needLogin = async (req, res, next) => {
    if (!res.locals.userid) {
        if (req.headers["accept"]?.includes("application/json")) {
            return res.status(401).json({
                status: "error",
                message: "需要登录",
                code: "ZC_ERROR_NEED_LOGIN",
            });
        } else {
            const frontendUrl = await zcconfig.get("urls.frontend");
            const loginUrl = new URL("/app/account/login", frontendUrl);
            // 尽量带回当前完整路径，便于登录后继续业务（如 OAuth 授权）
            const referer = req.get("referer");
            if (referer) {
                try {
                    const refererUrl = new URL(referer);
                    const frontendOrigin = new URL(frontendUrl).origin;
                    if (refererUrl.origin === frontendOrigin) {
                        loginUrl.searchParams.set(
                            "redirect",
                            `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`
                        );
                    }
                } catch {
                    // ignore invalid referer
                }
            }
            return res.redirect(loginUrl.toString());
        }
    }
    next();
};

/**
 * 需要管理员权限的中间件
 * 命中管理员名单后, 为请求附加 admin:* scope 语义 (供下游 requireScope 使用)。
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const needAdmin = async (req, res, next) => {
    if (!res.locals.userid) {
        if (req.headers["accept"]?.includes("application/json")) {
            return res.status(401).send({
                status: "error",
                message: "需要登录",
                code: "ZC_ERROR_NEED_LOGIN",
            });
        } else {
            return res.redirect("/login");
        }
    }

    try {
        let isAdmin = await userSatisfiesPolicy(res.locals.userid, "admin:manage");

        if (!isAdmin) {
            const adminUsers = await zcconfig.get("security.adminusers");
            const adminUserIds = Array.isArray(adminUsers) ? adminUsers.map(String) : [];
            if (adminUserIds.includes(res.locals.userid.toString())) {
                await assignRoleToUser(res.locals.userid, SYSTEM_ROLE_KEYS.ADMIN, {
                    reason: "system-config-admin",
                });
                isAdmin = await userSatisfiesPolicy(res.locals.userid, "admin:manage");
            }
        }

        if (!isAdmin) {
            return res.status(403).json({
                status: "error",
                message: "需要管理员权限",
                code: "ZC_ERROR_FORBIDDEN",
            });
        }

        if (!scopeSatisfies(res.locals.scopes || [], "admin:manage")) {
            return res.status(403).json({
                status: "error",
                message: "管理员令牌权限不足",
                code: "ZC_ERROR_INSUFFICIENT_SCOPE",
                required: "admin:manage",
            });
        }

        next();
    } catch (err) {
        logger.error("验证管理员权限时出错:", err);
        return res.status(500).json({
            status: "error",
            message: "服务器错误",
            code: 500,
        });
    }
};
