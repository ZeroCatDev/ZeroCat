/**
 * 精细化 Scope 鉴权中间件
 *
 * 配合 services/auth/scopes.js 的规范使用。令牌验证 (设置 res.locals.scopes)
 * 由全局认证中间件 (middleware.js) 完成, 这里只做 scope 匹配检查。
 *
 * 用法:
 *   router.put("/id/:id", requireResource("project", "update", "id"), handler)
 *   router.get("/me", requireScope("user:read"), handler)
 *   router.post("/follow", requireScope((req) => `follow:interact`), handler)
 */

import logger from "../services/logger.js";
import { parseScope, scopeSatisfies, userCanAccessResourceScope } from "../services/auth/scopes.js";
import { userSatisfiesPolicy } from "../services/auth/policyEngine.js";

/**
 * 要求令牌满足指定 scope
 * @param {string|string[]|((req:import('express').Request,res:import('express').Response)=>string|string[])} required scope 字符串, 或根据请求动态构造的函数
 * @returns {import('express').RequestHandler}
 */
export function requireScope(required) {
    return async (req, res, next) => {
        // 未登录
        if (!res.locals.userid) {
            if (req.headers["accept"]?.includes("application/json")) {
                return res.status(401).json({
                    status: "error",
                    message: "需要登录",
                    code: "ZC_ERROR_NEED_LOGIN",
                });
            }
            return res.status(401).json({
                status: "error",
                message: "需要登录",
                code: "ZC_ERROR_NEED_LOGIN",
            });
        }

        const requiredValue = typeof required === "function" ? required(req, res) : required;
        const requiredScopes = (Array.isArray(requiredValue) ? requiredValue : [requiredValue])
            .map((scope) => String(scope || "").trim())
            .filter(Boolean);

        if (requiredScopes.length === 0) {
            // 无法构造要求 (如缺少 params), 视为已登录放行
            return next();
        }

        const granted = Array.isArray(res.locals.scopes) ? res.locals.scopes : [];
        const missingScope = requiredScopes.find((scope) => !scopeSatisfies(granted, scope));

        if (!missingScope) {
            for (const requiredScope of requiredScopes) {
                const allowedByRole = await userSatisfiesPolicy(
                    res.locals.userid,
                    requiredScope
                );
                if (!allowedByRole) {
                    logger.debug(
                        `用户 ${res.locals.userid} 角色策略不足: 需要 ${requiredScope}`
                    );
                    return res.status(403).json({
                        status: "error",
                        message: "账号角色权限不足",
                        code: "ZC_ERROR_ROLE_POLICY_FORBIDDEN",
                        required: requiredScope,
                    });
                }
            }

            for (const requiredScope of requiredScopes) {
                const parsed = parseScope(requiredScope);
                if (parsed?.id === null || parsed?.id === undefined) continue;

                const withinUserBoundary = await userCanAccessResourceScope(
                    res.locals.userid,
                    requiredScope
                );
                if (!withinUserBoundary) {
                    logger.debug(
                        `用户 ${res.locals.userid} 资源权限越界: ${requiredScope}`
                    );
                    return res.status(403).json({
                        status: "error",
                        message: "无权访问该资源",
                        code: "ZC_ERROR_SCOPE_RESOURCE_FORBIDDEN",
                        required: requiredScope,
                    });
                }
            }
            return next();
        }

        logger.debug(
            `用户 ${res.locals.userid} 令牌权限不足: 需要 ${missingScope}, 拥有 ${JSON.stringify(granted)}`
        );
        return res.status(403).json({
            status: "error",
            message: "令牌权限不足",
            code: "ZC_ERROR_INSUFFICIENT_SCOPE",
            required: missingScope,
        });
    };
}

function hasValue(value) {
    return value !== undefined
        && value !== null
        && (Array.isArray(value) || String(value).length > 0);
}

function readValue(source, key) {
    if (!source || !key) return undefined;
    const direct = source[key];
    if (hasValue(direct)) return direct;

    if (!String(key).includes(".")) return undefined;
    const nested = String(key)
        .split(".")
        .reduce((value, part) => (value && value[part] !== undefined ? value[part] : undefined), source);
    return hasValue(nested) ? nested : undefined;
}

function resolveResourceId(req, selector) {
    if (!selector) return undefined;
    if (typeof selector === "function") return selector(req);
    if (Array.isArray(selector)) {
        for (const item of selector) {
            const value = resolveResourceId(req, item);
            if (hasValue(value)) return value;
        }
        return undefined;
    }
    if (typeof selector !== "string") return undefined;

    return (
        readValue(req.params, selector) ??
        readValue(req.body, selector) ??
        readValue(req.query, selector) ??
        readValue(req.headers, selector.toLowerCase())
    );
}

/**
 * 便捷工厂: 构造资源 scope 要求。
 * 提供 idParam 时生成实例级 scope (resource:<id>:action), 否则生成类型级 (resource:action)。
 * @param {string} resource 资源类型
 * @param {string} action 动作
 * @param {string|string[]|((req:import('express').Request)=>string|string[])} [idParam] 资源ID来源
 * @returns {import('express').RequestHandler}
 */
export function requireResource(resource, action, idParam) {
    return requireScope((req) => {
        if (idParam) {
            const id = resolveResourceId(req, idParam);
            if (Array.isArray(id)) {
                const ids = id.filter((item) => hasValue(item));
                if (ids.length > 0) {
                    return ids.map((item) => `${resource}:${item}:${action}`);
                }
            }
            if (hasValue(id)) {
                return `${resource}:${id}:${action}`;
            }
        }
        return `${resource}:${action}`;
    });
}

export default { requireScope, requireResource };
