import { Router } from "express";
import { needLogin } from "../middleware/auth.js";
import { requireSudo } from "../middleware/sudo.js";
import { requireScope } from "../middleware/scope.js";
import logger from "../services/logger.js";
import zcconfig from "../services/config/zcconfig.js";
import {
    issueToken,
    listUserTokens,
    revokeToken,
    introspectToken,
} from "../services/auth/tokenService.js";
import {
    ACTION_DEFINITIONS,
    SCOPE_CATALOG,
    SCOPE_CATEGORIES,
    SCOPE_PRESETS,
    isScopeSubset,
    isValidScope,
    normalizeScopes,
    validateUserGrantableScopes,
} from "../services/auth/scopes.js";
import { prisma } from "../services/prisma.js";

const router = Router();

// 所有路由都需要登录
router.use(needLogin);

/**
 * 获取可选的 scope 目录 (供前端权限选择器)
 * GET /tokens/scopes
 */
router.get("/scopes", async (req, res) => {
    const catalogChecks = await Promise.all(
        SCOPE_CATALOG.map(async (item) => {
            if (!isScopeSubset([item.name], res.locals.scopes || [])) {
                return null;
            }
            const grantCheck = await validateUserGrantableScopes(res.locals.userid, [item.name]);
            return grantCheck.allowed ? item : null;
        })
    );
    const grantableCatalog = catalogChecks.filter(Boolean);
    const grantableScopeNames = new Set(grantableCatalog.map((item) => item.name));
    const grantablePresets = SCOPE_PRESETS
        .map((preset) => ({
            ...preset,
            scopes: preset.scopes.filter((scopeName) => grantableScopeNames.has(scopeName)),
        }))
        .filter((preset) => preset.scopes.length > 0);

    res.json({
        status: "success",
        data: grantableCatalog,
        presets: grantablePresets,
        categories: SCOPE_CATEGORIES,
        actions: ACTION_DEFINITIONS,
    });
});

/**
 * 内省令牌 - 输入任意令牌, 返回其归属与元数据 (调试工具)
 * POST /tokens/introspect  body: { token }
 *
 * 隐私: 仅当令牌属于当前用户, 或当前用户是管理员时, 返回归属用户身份等敏感字段;
 * 否则只返回有效性/类型/scope 等非敏感信息。
 */
router.post("/introspect", requireScope("token:read"), async (req, res) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== "string") {
            return res.status(400).json({
                status: "error",
                message: "请提供要查询的令牌",
                code: "INVALID_TOKEN",
            });
        }

        const info = await introspectToken(token);
        if (!info) {
            return res.json({
                status: "success",
                data: { found: false },
            });
        }

        // 判定查看者权限
        const adminUsers = (await zcconfig.get("security.adminusers")) || [];
        const isAdmin = Array.isArray(adminUsers)
            && adminUsers.includes(String(res.locals.userid));
        const isOwner = info.user_id === res.locals.userid;
        const canSeeOwner = isAdmin || isOwner;

        const data = {
            found: true,
            active: info.active,
            revoked: info.revoked,
            expired: info.expired,
            type: info.type,
            scopes: info.scopes,
            token_prefix: info.token_prefix,
            expires_at: info.expires_at,
            created_at: info.created_at,
            last_used_at: info.last_used_at,
            is_owner: isOwner,
        };

        if (canSeeOwner) {
            data.token_id = info.token_id;
            data.name = info.name;
            data.user = info.user;
            data.application = info.application;
            data.last_used_ip = info.last_used_ip;
            data.ip_address = info.ip_address;
            data.activity_count = info.activity_count;
            data.device_info = info.device_info;
        }

        res.json({ status: "success", data });
    } catch (error) {
        logger.error("内省令牌时出错:", error);
        res.status(500).json({
            status: "error",
            message: "查询令牌失败",
            code: "INTROSPECT_FAILED",
        });
    }
});

/**
 * 创建个人 API 令牌
 * POST /tokens
 * body: { name, scopes: string[], expires_in?: number(秒, -1或省略=永不过期) }
 */
router.post("/", requireScope("token:manage"), requireSudo, async (req, res) => {
    try {
        const { name, scopes, expires_in } = req.body;
        const userId = res.locals.userid;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({
                status: "error",
                message: "令牌名称不能为空",
                code: "INVALID_TOKEN_NAME",
            });
        }
        if (name.length > 255) {
            return res.status(400).json({
                status: "error",
                message: "令牌名称不能超过255个字符",
                code: "TOKEN_NAME_TOO_LONG",
            });
        }

        // 校验 scopes
        if (!Array.isArray(scopes) || scopes.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "必须指定至少一个权限范围 (scope)",
                code: "INVALID_SCOPES",
            });
        }
        const invalid = scopes.filter((s) => !isValidScope(s));
        if (invalid.length > 0) {
            return res.status(400).json({
                status: "error",
                message: `存在非法的权限范围: ${invalid.join(", ")}`,
                code: "INVALID_SCOPES",
            });
        }

        // 规范化: 去重并移除被更宽 scope 覆盖的冗余项 (如同时选 read+write 仅保留 write)
        const normalizedScopes = normalizeScopes(scopes);
        if (normalizedScopes.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "必须指定至少一个有效的权限范围 (scope)",
                code: "INVALID_SCOPES",
            });
        }
        if (!isScopeSubset(normalizedScopes, res.locals.scopes || [])) {
            return res.status(403).json({
                status: "error",
                message: "请求的权限范围不能超过当前令牌已有权限",
                code: "ZC_ERROR_SCOPE_ESCALATION",
            });
        }
        const grantCheck = await validateUserGrantableScopes(userId, normalizedScopes);
        if (!grantCheck.allowed) {
            return res.status(403).json({
                status: "error",
                message: "请求的权限范围超过用户本身权限",
                code: "ZC_ERROR_SCOPE_ESCALATION",
                denied_scopes: grantCheck.denied,
            });
        }

        // 解析过期时间
        let accessTokenExpiry = null; // null = 永不过期
        if (expires_in !== undefined && expires_in !== null && expires_in !== -1) {
            const seconds = parseInt(expires_in, 10);
            if (isNaN(seconds) || seconds <= 0) {
                return res.status(400).json({
                    status: "error",
                    message: "过期时间必须是正整数或 -1 (永不过期)",
                    code: "INVALID_EXPIRES_IN",
                });
            }
            accessTokenExpiry = seconds;
        }

        const result = await issueToken({
            userId,
            type: "personal",
            name: name.trim(),
            scopes: normalizedScopes,
            accessTokenExpiry,
            ip: req.ipInfo?.clientIP || req.ip,
            userAgent: req.headers["user-agent"],
        });

        if (!result.success) {
            return res.status(500).json({
                status: "error",
                message: "创建令牌失败",
                code: "CREATE_TOKEN_FAILED",
            });
        }

        logger.info(`用户 ${userId} 创建了个人令牌: ${result.tokenId} scopes=${JSON.stringify(normalizedScopes)}`);

        res.json({
            status: "success",
            message: "令牌创建成功",
            data: {
                id: result.tokenId,
                name: name.trim(),
                token: result.accessToken, // 只在创建时返回完整令牌
                scopes: normalizedScopes,
                expires_at: result.expiresAt,
            },
        });
    } catch (error) {
        logger.error("创建个人令牌时出错:", error);
        res.status(500).json({
            status: "error",
            message: "创建令牌失败",
            code: "CREATE_TOKEN_FAILED",
        });
    }
});

/**
 * 列出当前用户的个人令牌
 * GET /tokens
 */
router.get("/", requireScope("token:read"), async (req, res) => {
    try {
        const tokens = await listUserTokens(res.locals.userid, { type: "personal" });
        res.json({ status: "success", data: tokens });
    } catch (error) {
        logger.error("获取令牌列表时出错:", error);
        res.status(500).json({
            status: "error",
            message: "获取令牌列表失败",
            code: "GET_TOKENS_FAILED",
        });
    }
});

/**
 * 获取单个个人令牌详情
 * GET /tokens/:id
 */
router.get("/:id", requireScope("token:read"), async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id, 10);
        if (isNaN(tokenId)) {
            return res.status(400).json({ status: "error", message: "无效的令牌ID", code: "INVALID_TOKEN_ID" });
        }
        const token = await prisma.ow_tokens.findFirst({
            where: { id: tokenId, user_id: res.locals.userid, type: "personal" },
            select: {
                id: true, name: true, token_prefix: true, scopes: true,
                expires_at: true, last_used_at: true, last_used_ip: true,
                activity_count: true, revoked: true, revoked_at: true,
                created_at: true, updated_at: true,
            },
        });
        if (!token) {
            return res.status(404).json({ status: "error", message: "令牌不存在", code: "TOKEN_NOT_FOUND" });
        }
        res.json({ status: "success", data: token });
    } catch (error) {
        logger.error("获取令牌详情时出错:", error);
        res.status(500).json({ status: "error", message: "获取令牌详情失败", code: "GET_TOKEN_FAILED" });
    }
});

/**
 * 吊销 (删除) 个人令牌
 * DELETE /tokens/:id
 */
router.delete("/:id", requireScope("token:manage"), requireSudo, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id, 10);
        if (isNaN(tokenId)) {
            return res.status(400).json({ status: "error", message: "无效的令牌ID", code: "INVALID_TOKEN_ID" });
        }

        // 校验归属
        const token = await prisma.ow_tokens.findFirst({
            where: { id: tokenId, user_id: res.locals.userid, type: "personal" },
        });
        if (!token) {
            return res.status(404).json({ status: "error", message: "令牌不存在或无权限", code: "TOKEN_NOT_FOUND" });
        }

        const result = await revokeToken(tokenId);
        if (!result.success) {
            return res.status(400).json({ status: "error", message: result.message || "吊销失败", code: "REVOKE_TOKEN_FAILED" });
        }

        logger.info(`用户 ${res.locals.userid} 吊销了个人令牌: ${tokenId}`);
        res.json({ status: "success", message: "令牌已吊销" });
    } catch (error) {
        logger.error("吊销令牌时出错:", error);
        res.status(500).json({ status: "error", message: "吊销令牌失败", code: "REVOKE_TOKEN_FAILED" });
    }
});

export default router;
