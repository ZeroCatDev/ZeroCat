import { Router } from "express";
import { needLogin } from "../middleware/auth.js";
import { requireSudo } from "../middleware/sudo.js";
import { prisma } from "../services/global.js";
import logger from "../services/logger.js";
import { createHash, randomBytes } from "crypto";
import { verifyAccountToken, updateAccountTokenUsage } from "../services/auth/accountTokenService.js";

const router = Router();

// 所有路由都需要登录
router.use(needLogin);

/**
 * 创建新的账户令牌
 * POST /accounttoken/create
 */
router.post("/create", requireSudo, async (req, res) => {
    try {
        const { name, expires_in } = req.body;
        const userId = res.locals.userid;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({
                status: "error",
                message: "令牌名称不能为空",
                code: "INVALID_TOKEN_NAME"
            });
        }

        if (name.length > 255) {
            return res.status(400).json({
                status: "error",
                message: "令牌名称不能超过255个字符",
                code: "TOKEN_NAME_TOO_LONG"
            });
        }

        // 生成令牌
        const token = `zc_${randomBytes(32).toString('hex')}`;

        // 计算过期时间
        let expiresAt = null;
        if (expires_in && expires_in !== -1) {
            const expiresInSeconds = parseInt(expires_in);
            if (isNaN(expiresInSeconds) || expiresInSeconds <= 0) {
                return res.status(400).json({
                    status: "error",
                    message: "过期时间必须是正整数或-1（永不过期）",
                    code: "INVALID_EXPIRES_IN"
                });
            }
            expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
        }

        // 创建令牌记录
        const tokenRecord = await prisma.ow_account_tokens.create({
            data: {
                user_id: userId,
                name: name.trim(),
                token: token,
                expires_at: expiresAt,
                last_used_ip: req.ipInfo?.clientIP || req.ip
            }
        });

        logger.info(`用户 ${userId} 创建了新的账户令牌: ${tokenRecord.id}`);

        res.json({
            status: "success",
            message: "令牌创建成功",
            data: {
                id: tokenRecord.id,
                name: tokenRecord.name,
                token: token, // 只在创建时返回完整令牌
                expires_at: tokenRecord.expires_at,
                created_at: tokenRecord.created_at
            }
        });
    } catch (error) {
        logger.error("创建账户令牌时出错:", error);
        res.status(500).json({
            status: "error",
            message: "创建令牌失败",
            code: "CREATE_TOKEN_FAILED"
        });
    }
});

/**
 * 获取用户的令牌列表
 * GET /accounttoken/list
 */
router.get("/list", async (req, res) => {
    try {
        const userId = res.locals.userid;

        const tokens = await prisma.ow_account_tokens.findMany({
            where: {
                user_id: userId
            },
            select: {
                id: true,
                name: true,
                expires_at: true,
                is_revoked: true,
                revoked_at: true,
                last_used_at: true,
                last_used_ip: true,
                created_at: true,
                updated_at: true
            },
            orderBy: {
                created_at: "desc"
            }
        });

        res.json({
            status: "success",
            data: tokens
        });
    } catch (error) {
        logger.error("获取令牌列表时出错:", error);
        res.status(500).json({
            status: "error",
            message: "获取令牌列表失败",
            code: "GET_TOKENS_FAILED"
        });
    }
});

/**
 * 删除令牌
 * DELETE /accounttoken/delete/:id
 */
router.delete("/delete/:id", async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const userId = res.locals.userid;

        if (isNaN(tokenId)) {
            return res.status(400).json({
                status: "error",
                message: "无效的令牌ID",
                code: "INVALID_TOKEN_ID"
            });
        }

        // 检查令牌是否存在且属于当前用户
        const tokenRecord = await prisma.ow_account_tokens.findFirst({
            where: {
                id: tokenId,
                user_id: userId
            }
        });

        if (!tokenRecord) {
            return res.status(404).json({
                status: "error",
                message: "令牌不存在或无权限删除",
                code: "TOKEN_NOT_FOUND"
            });
        }

        // 删除令牌
        await prisma.ow_account_tokens.delete({
            where: {
                id: tokenId
            }
        });

        logger.info(`用户 ${userId} 删除了账户令牌: ${tokenId}`);

        res.json({
            status: "success",
            message: "令牌删除成功"
        });
    } catch (error) {
        logger.error("删除令牌时出错:", error);
        res.status(500).json({
            status: "error",
            message: "删除令牌失败",
            code: "DELETE_TOKEN_FAILED"
        });
    }
});

/**
 * 吊销令牌
 * POST /accounttoken/revoke/:id
 */
router.post("/revoke/:id", async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const userId = res.locals.userid;

        if (isNaN(tokenId)) {
            return res.status(400).json({
                status: "error",
                message: "无效的令牌ID",
                code: "INVALID_TOKEN_ID"
            });
        }

        // 检查令牌是否存在且属于当前用户
        const tokenRecord = await prisma.ow_account_tokens.findFirst({
            where: {
                id: tokenId,
                user_id: userId
            }
        });

        if (!tokenRecord) {
            return res.status(404).json({
                status: "error",
                message: "令牌不存在或无权限吊销",
                code: "TOKEN_NOT_FOUND"
            });
        }

        if (tokenRecord.is_revoked) {
            return res.status(400).json({
                status: "error",
                message: "令牌已经被吊销",
                code: "TOKEN_ALREADY_REVOKED"
            });
        }

        // 吊销令牌
        await prisma.ow_account_tokens.update({
            where: {
                id: tokenId
            },
            data: {
                is_revoked: true,
                revoked_at: new Date()
            }
        });

        logger.info(`用户 ${userId} 吊销了账户令牌: ${tokenId}`);

        res.json({
            status: "success",
            message: "令牌吊销成功"
        });
    } catch (error) {
        logger.error("吊销令牌时出错:", error);
        res.status(500).json({
            status: "error",
            message: "吊销令牌失败",
            code: "REVOKE_TOKEN_FAILED"
        });
    }
});



export default router;