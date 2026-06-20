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
import { scopeSatisfies } from "../services/auth/scopes.js";

/**
 * 要求令牌满足指定 scope
 * @param {string|((req:import('express').Request)=>string)} required scope 字符串, 或根据请求动态构造的函数
 * @returns {import('express').RequestHandler}
 */
export function requireScope(required) {
    return (req, res, next) => {
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

        const requiredScope = typeof required === "function" ? required(req) : required;

        if (!requiredScope) {
            // 无法构造要求 (如缺少 params), 视为已登录放行
            return next();
        }

        const granted = Array.isArray(res.locals.scopes) ? res.locals.scopes : [];

        if (scopeSatisfies(granted, requiredScope)) {
            return next();
        }

        logger.debug(
            `用户 ${res.locals.userid} 令牌权限不足: 需要 ${requiredScope}, 拥有 ${JSON.stringify(granted)}`
        );
        return res.status(403).json({
            status: "error",
            message: "令牌权限不足",
            code: "ZC_ERROR_INSUFFICIENT_SCOPE",
            required: requiredScope,
        });
    };
}

/**
 * 便捷工厂: 构造资源 scope 要求。
 * 提供 idParam 时生成实例级 scope (resource:<id>:action), 否则生成类型级 (resource:action)。
 * @param {string} resource 资源类型
 * @param {string} action 动作
 * @param {string} [idParam] req.params 中的资源ID参数名
 * @returns {import('express').RequestHandler}
 */
export function requireResource(resource, action, idParam) {
    return requireScope((req) => {
        if (idParam) {
            const id = req.params?.[idParam];
            if (id !== undefined && id !== null && String(id).length > 0) {
                return `${resource}:${id}:${action}`;
            }
        }
        return `${resource}:${action}`;
    });
}

export default { requireScope, requireResource };
