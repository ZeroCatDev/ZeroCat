import express from "express";
import { prisma } from "../../services/prisma.js";
import logger from "../../services/logger.js";

const router = express.Router();

const parseBooleanInput = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
    if (typeof value !== "string") return null;

    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on", "enable", "enabled"].includes(normalized)) return true;
    if (["0", "false", "no", "off", "disable", "disabled"].includes(normalized)) return false;
    return null;
};

const parsePositiveInt = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
};

const buildIdentifierFilter = (identifier) => {
    const raw = String(identifier || "").trim();
    if (!raw) return null;

    const numericId = parsePositiveInt(raw);
    if (numericId) {
        return {
            OR: [{ id: numericId }, { client_id: raw }],
        };
    }
    return { client_id: raw };
};

const getApplicationByIdentifier = async (identifier, select) => {
    const where = buildIdentifierFilter(identifier);
    if (!where) return null;

    return prisma.ow_oauth_applications.findFirst({
        where,
        select,
    });
};

const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return null;

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const parseStringInput = (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== "string") return null;
    return value.trim();
};

/**
 * @route GET /admin/oauth/applications
 * @desc 管理员获取 OAuth 应用列表（支持搜索/筛选/分页）
 * @access Admin
 */
router.get("/applications", async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = "",
            status,
            type,
            owner_id,
            is_verified,
            is_public,
            sortBy = "created_at",
            sortOrder = "desc",
        } = req.query;

        const pageNum = Math.max(parsePositiveInt(page) || 1, 1);
        const limitNum = Math.min(Math.max(parsePositiveInt(limit) || 20, 1), 100);

        const allowedSortFields = new Set([
            "id",
            "name",
            "client_id",
            "status",
            "type",
            "is_verified",
            "is_public",
            "created_at",
            "updated_at",
            "owner_id",
        ]);
        const sortField = allowedSortFields.has(String(sortBy)) ? String(sortBy) : "created_at";
        const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? "asc" : "desc";

        const where = {};
        const normalizedSearch = String(search || "").trim();
        if (normalizedSearch) {
            where.OR = [
                { name: { contains: normalizedSearch, mode: "insensitive" } },
                { description: { contains: normalizedSearch, mode: "insensitive" } },
                { client_id: { contains: normalizedSearch, mode: "insensitive" } },
                {
                    owner: {
                        is: {
                            OR: [
                                { username: { contains: normalizedSearch, mode: "insensitive" } },
                                { display_name: { contains: normalizedSearch, mode: "insensitive" } },
                                { email: { contains: normalizedSearch, mode: "insensitive" } },
                            ],
                        },
                    },
                },
            ];
        }

        if (status) {
            where.status = String(status);
        }
        if (type) {
            where.type = String(type);
        }
        if (owner_id !== undefined) {
            const ownerId = parsePositiveInt(owner_id);
            if (!ownerId) {
                return res.status(400).json({ error: "owner_id 必须是正整数" });
            }
            where.owner_id = ownerId;
        }
        if (is_verified !== undefined) {
            const parsedVerified = parseBooleanInput(is_verified);
            if (parsedVerified === null) {
                return res.status(400).json({ error: "is_verified 必须是布尔值" });
            }
            where.is_verified = parsedVerified;
        }
        if (is_public !== undefined) {
            const parsedPublic = parseBooleanInput(is_public);
            if (parsedPublic === null) {
                return res.status(400).json({ error: "is_public 必须是布尔值" });
            }
            where.is_public = parsedPublic;
        }

        const [items, total] = await Promise.all([
            prisma.ow_oauth_applications.findMany({
                where,
                orderBy: {
                    [sortField]: normalizedSortOrder,
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    client_id: true,
                    type: true,
                    status: true,
                    is_verified: true,
                    is_public: true,
                    owner_id: true,
                    created_at: true,
                    updated_at: true,
                    owner: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                            email: true,
                        },
                    },
                    _count: {
                        select: {
                            authorizations: true,
                            access_tokens: true,
                        },
                    },
                },
            }),
            prisma.ow_oauth_applications.count({ where }),
        ]);

        return res.json({
            items,
            total,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        logger.error("Admin get OAuth applications error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @route GET /admin/oauth/applications/:identifier
 * @desc 管理员获取 OAuth 应用详情（identifier 支持 id 或 client_id）
 * @access Admin
 */
router.get("/applications/:identifier", async (req, res) => {
    try {
        const { identifier } = req.params;
        const application = await getApplicationByIdentifier(identifier, {
            id: true,
            owner_id: true,
            name: true,
            description: true,
            homepage_url: true,
            client_id: true,
            redirect_uris: true,
            type: true,
            client_type: true,
            scopes: true,
            webhook_url: true,
            logo_url: true,
            terms_url: true,
            privacy_url: true,
            status: true,
            is_verified: true,
            is_public: true,
            created_at: true,
            updated_at: true,
            owner: {
                select: {
                    id: true,
                    username: true,
                    display_name: true,
                    email: true,
                    status: true,
                },
            },
            _count: {
                select: {
                    authorizations: true,
                    access_tokens: true,
                },
            },
        });

        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }

        return res.json(application);
    } catch (error) {
        logger.error("Admin get OAuth application detail error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @route PUT /admin/oauth/applications/:identifier
 * @desc 管理员更新 OAuth 应用信息（identifier 支持 id 或 client_id）
 * @access Admin
 */
router.put("/applications/:identifier", async (req, res) => {
    try {
        const { identifier } = req.params;
        const application = await getApplicationByIdentifier(identifier, {
            id: true,
            status: true,
        });

        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }

        const {
            owner_id,
            name,
            description,
            homepage_url,
            redirect_uris,
            type,
            client_type,
            scopes,
            webhook_url,
            logo_url,
            terms_url,
            privacy_url,
            status,
            is_public,
            is_verified,
        } = req.body || {};

        const updateData = {};

        if (owner_id !== undefined) {
            const parsedOwnerId = parsePositiveInt(owner_id);
            if (!parsedOwnerId) {
                return res.status(400).json({ error: "owner_id 必须是正整数" });
            }

            const owner = await prisma.ow_users.findUnique({
                where: { id: parsedOwnerId },
                select: { id: true },
            });
            if (!owner) {
                return res.status(400).json({ error: "owner_id 对应用户不存在" });
            }
            updateData.owner_id = parsedOwnerId;
        }

        if (name !== undefined) {
            const parsedName = parseStringInput(name);
            if (parsedName === null || !parsedName) {
                return res.status(400).json({ error: "name 必须是非空字符串" });
            }
            updateData.name = parsedName;
        }

        if (description !== undefined) {
            const parsedDescription = parseStringInput(description);
            if (parsedDescription === null) {
                return res.status(400).json({ error: "description 必须是字符串" });
            }
            updateData.description = parsedDescription || null;
        }

        if (homepage_url !== undefined) {
            const parsedHomepageUrl = parseStringInput(homepage_url);
            if (parsedHomepageUrl === null) {
                return res.status(400).json({ error: "homepage_url 必须是字符串" });
            }
            updateData.homepage_url = parsedHomepageUrl || null;
        }

        if (type !== undefined) {
            const parsedType = parseStringInput(type);
            if (parsedType === null || !parsedType) {
                return res.status(400).json({ error: "type 必须是非空字符串" });
            }
            updateData.type = parsedType;
        }

        if (client_type !== undefined) {
            const parsedClientType = parseStringInput(client_type);
            if (parsedClientType === null || !parsedClientType) {
                return res.status(400).json({ error: "client_type 必须是非空字符串" });
            }
            updateData.client_type = parsedClientType;
        }

        if (webhook_url !== undefined) {
            const parsedWebhookUrl = parseStringInput(webhook_url);
            if (parsedWebhookUrl === null) {
                return res.status(400).json({ error: "webhook_url 必须是字符串" });
            }
            updateData.webhook_url = parsedWebhookUrl || null;
        }

        if (logo_url !== undefined) {
            const parsedLogoUrl = parseStringInput(logo_url);
            if (parsedLogoUrl === null) {
                return res.status(400).json({ error: "logo_url 必须是字符串" });
            }
            updateData.logo_url = parsedLogoUrl || null;
        }

        if (terms_url !== undefined) {
            const parsedTermsUrl = parseStringInput(terms_url);
            if (parsedTermsUrl === null) {
                return res.status(400).json({ error: "terms_url 必须是字符串" });
            }
            updateData.terms_url = parsedTermsUrl || null;
        }

        if (privacy_url !== undefined) {
            const parsedPrivacyUrl = parseStringInput(privacy_url);
            if (parsedPrivacyUrl === null) {
                return res.status(400).json({ error: "privacy_url 必须是字符串" });
            }
            updateData.privacy_url = parsedPrivacyUrl || null;
        }

        if (status !== undefined) {
            const parsedStatus = parseStringInput(status);
            if (parsedStatus === null || !parsedStatus) {
                return res.status(400).json({ error: "status 必须是非空字符串" });
            }
            if (parsedStatus.toLowerCase() === "deleted") {
                return res.status(400).json({ error: "如需删除应用，请调用删除接口" });
            }
            updateData.status = parsedStatus;
        }

        if (redirect_uris !== undefined) {
            const parsedRedirectUris = parseJsonArray(redirect_uris);
            if (!parsedRedirectUris) {
                return res.status(400).json({ error: "redirect_uris 必须是数组" });
            }
            updateData.redirect_uris = parsedRedirectUris;
        }

        if (scopes !== undefined) {
            const parsedScopes = parseJsonArray(scopes);
            if (!parsedScopes) {
                return res.status(400).json({ error: "scopes 必须是数组" });
            }
            updateData.scopes = parsedScopes;
        }

        if (is_public !== undefined) {
            const parsedPublic = parseBooleanInput(is_public);
            if (parsedPublic === null) {
                return res.status(400).json({ error: "is_public 必须是布尔值" });
            }
            updateData.is_public = parsedPublic;
        }

        if (is_verified !== undefined) {
            const parsedVerified = parseBooleanInput(is_verified);
            if (parsedVerified === null) {
                return res.status(400).json({ error: "is_verified 必须是布尔值" });
            }
            updateData.is_verified = parsedVerified;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "没有可更新的字段" });
        }

        const updated = await prisma.ow_oauth_applications.update({
            where: { id: application.id },
            data: {
                ...updateData,
                updated_at: new Date(),
            },
            select: {
                id: true,
                owner_id: true,
                name: true,
                description: true,
                homepage_url: true,
                client_id: true,
                redirect_uris: true,
                type: true,
                client_type: true,
                scopes: true,
                webhook_url: true,
                logo_url: true,
                terms_url: true,
                privacy_url: true,
                status: true,
                is_verified: true,
                is_public: true,
                created_at: true,
                updated_at: true,
            },
        });

        return res.json({
            message: "应用更新成功",
            previous_status: application.status,
            application: updated,
        });
    } catch (error) {
        logger.error("Admin update OAuth application error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @route PUT /admin/oauth/applications/:identifier/verified
 * @desc 管理员设置 OAuth 应用已验证状态（identifier 支持 id 或 client_id）
 * @access Admin
 */
router.put("/applications/:identifier/verified", async (req, res) => {
    try {
        const { identifier } = req.params;
        if (req.body?.is_verified === undefined) {
            return res.status(400).json({ error: "缺少参数 is_verified" });
        }

        const parsedVerified = parseBooleanInput(req.body.is_verified);
        if (parsedVerified === null) {
            return res.status(400).json({ error: "is_verified 必须是布尔值" });
        }

        const application = await getApplicationByIdentifier(identifier, {
            id: true,
            client_id: true,
            name: true,
            is_verified: true,
            status: true,
        });

        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }

        const updated = await prisma.ow_oauth_applications.update({
            where: { id: application.id },
            data: {
                is_verified: parsedVerified,
                updated_at: new Date(),
            },
            select: {
                id: true,
                client_id: true,
                name: true,
                status: true,
                is_verified: true,
                updated_at: true,
            },
        });

        return res.json({
            message: parsedVerified ? "应用已设为已验证" : "应用已取消验证",
            application: updated,
        });
    } catch (error) {
        logger.error("Admin set OAuth application verification error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @route DELETE /admin/oauth/applications/:identifier
 * @desc 管理员下线 OAuth 应用（软删除，并撤销相关授权）
 * @access Admin
 */
router.delete("/applications/:identifier", async (req, res) => {
    try {
        const { identifier } = req.params;
        const application = await getApplicationByIdentifier(identifier, {
            id: true,
            client_id: true,
            status: true,
        });

        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        if (application.status === "deleted") {
            return res.status(400).json({ error: "Application already deleted" });
        }

        await prisma.$transaction([
            prisma.ow_oauth_applications.update({
                where: { id: application.id },
                data: {
                    status: "deleted",
                    updated_at: new Date(),
                },
            }),
            prisma.ow_oauth_access_tokens.updateMany({
                where: { application_id: application.id },
                data: {
                    is_revoked: true,
                    updated_at: new Date(),
                },
            }),
            prisma.ow_oauth_authorizations.updateMany({
                where: { application_id: application.id },
                data: {
                    status: "revoked",
                    updated_at: new Date(),
                },
            }),
        ]);

        return res.json({
            message: "应用已下线并撤销相关授权",
            application: {
                id: application.id,
                client_id: application.client_id,
                status: "deleted",
            },
        });
    } catch (error) {
        logger.error("Admin delete OAuth application error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
