import { createHash } from 'crypto';
import axios from 'axios';
import { prisma } from '../prisma.js';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';
import { uploadFile } from '../assets.js';

const TARGET_TYPE_USER = 'mirror40_user';
const TARGET_TYPE_PROJECT = 'mirror40_project';
const TARGET_KEY_LOCAL_USER_ID = 'local_user_id';
const TARGET_KEY_LOCAL_PROJECT_ID = 'local_project_id';
const TARGET_KEY_LOCAL_PROFILE_PROJECT_ID = 'local_profile_project_id';
const MAX_AVATAR_DOWNLOAD_SIZE = 10 * 1024 * 1024;

const USER_SEARCH_PAYLOAD = {
    name: '',
    author: '',
    type: 1,
    s: '4',
    sid: '',
    fl: 0,
    fan: 0,
    follow: 0,
    page: '1',
    folder: 0,
};

const PROJECT_SEARCH_PAYLOAD = {
    name: '',
    author: '',
    type: '0',
    s: '0',
    sid: '',
    fl: 0,
    fan: 0,
    follow: 0,
    page: '1',
    folder: 0,
};

function toDateFromUnixSeconds(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return new Date(n * 1000);
}

function sanitizeDisplayName(name, fallback) {
    const finalName = String(name || fallback || '').trim();
    if (!finalName) return fallback;
    return finalName.slice(0, 64);
}

function truncateText(value, maxLen) {
    const raw = String(value || '');
    if (raw.length <= maxLen) return raw;
    return raw.slice(0, maxLen);
}

function hashSource(source) {
    return createHash('sha256').update(source).digest('hex');
}

function buildCommitId(payload) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function stringifySource(source) {
    if (typeof source === 'string') return source;
    if (source === null || source === undefined) return '';
    return JSON.stringify(source);
}

function pickFirstArray(...candidates) {
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
    }
    return [];
}

function extractProjectList(payload) {
    if (!payload || typeof payload !== 'object') return [];
    const data = payload.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
        return pickFirstArray(data.work, data.works, data.project, data.projects, data.list, data.data);
    }
    return [];
}

function extractUserList(payload) {
    if (!payload || typeof payload !== 'object') return [];

    const data = payload.data;
    if (Array.isArray(data)) {
        return data.filter((item) => item && typeof item === 'object' && item.id !== undefined);
    }

    if (data && typeof data === 'object') {
        return pickFirstArray(
            data.user,
            data.users,
            data.userlist,
            data.list,
            data.data,
            payload.user,
            payload.users
        );
    }

    return pickFirstArray(payload.user, payload.users);
}

function sanitizeUrlForLog(url) {
    try {
        const u = new URL(url);
        if (u.searchParams.has('token')) {
            const token = u.searchParams.get('token') || '';
            const masked = token.length > 12
                ? `${token.slice(0, 6)}...${token.slice(-4)}`
                : '***';
            u.searchParams.set('token', masked);
        }
        return u.toString();
    } catch {
        return String(url).replace(/token=[^&]+/g, 'token=***');
    }
}

function truncateForLog(value, maxLen = 1500) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (!text) return '';
    return text.length > maxLen ? `${text.slice(0, maxLen)}...(truncated)` : text;
}

function buildAvatarFilename(avatarValue) {
    const raw = String(avatarValue || '').trim();
    if (!raw) return 'avatar';
    const withoutQuery = raw.split('?')[0].split('#')[0];
    const name = withoutQuery.split('/').pop() || 'avatar';
    return truncateText(name, 120) || 'avatar';
}

function buildAssetFileName(assetValue, fallback = 'asset') {
    const raw = String(assetValue || '').trim();
    if (!raw) return fallback;
    const withoutQuery = raw.split('?')[0].split('#')[0];
    const name = withoutQuery.split('/').pop() || fallback;
    return truncateText(name, 120) || fallback;
}

function buildAvatarUrlCandidates(baseUrl, remoteUser) {
    const baseOrigin = (() => {
        try {
            return new URL(baseUrl).origin;
        } catch {
            return '';
        }
    })();

    const assetOrigins = (() => {
        const ordered = [];
        const pushUnique = (value) => {
            if (!value) return;
            if (!ordered.includes(value)) ordered.push(value);
        };

        pushUnique('https://abc.520gxx.com');

        if (baseOrigin) {
            const nonApiOrigin = baseOrigin.replace(/^(https?:\/\/)api\./i, '$1');
            const fromApiAbc = baseOrigin.replace(/^(https?:\/\/)api\.abc\./i, '$1abc.');

            pushUnique(nonApiOrigin);
            pushUnique(fromApiAbc);
            pushUnique(baseOrigin);
        }

        return ordered;
    })();

    const rawValues = [
        remoteUser?.head,
        remoteUser?.avatar,
        remoteUser?.image,
        remoteUser?.icon,
    ];

    const normalized = [];
    for (const raw of rawValues) {
        const value = String(raw || '').trim();
        if (!value) continue;

        if (/^\/\//.test(value)) {
            normalized.push(`https:${value}`);
            continue;
        }

        if (/^https?:\/\//i.test(value)) continue;

        if (value.startsWith('/')) {
            for (const origin of assetOrigins) {
                normalized.push(`${origin}${value}`);
            }
        } else {
            for (const origin of assetOrigins) {
                normalized.push(`${origin}/static/internalapi/asset/${value}`);
            }
        }
    }

    return Array.from(new Set(normalized));
}

function buildProjectCoverUrlCandidates(baseUrl, remoteProject) {
    const image = String(remoteProject?.image || '').trim();
    if (!image) return [];

    const baseOrigin = (() => {
        try {
            return new URL(baseUrl).origin;
        } catch {
            return '';
        }
    })();

    const assetOrigins = (() => {
        const ordered = [];
        const pushUnique = (value) => {
            if (!value) return;
            if (!ordered.includes(value)) ordered.push(value);
        };

        pushUnique('https://abc.520gxx.com');

        if (baseOrigin) {
            const nonApiOrigin = baseOrigin.replace(/^(https?:\/\/)api\./i, '$1');
            const fromApiAbc = baseOrigin.replace(/^(https?:\/\/)api\.abc\./i, '$1abc.');

            pushUnique(nonApiOrigin);
            pushUnique(fromApiAbc);
            pushUnique(baseOrigin);
        }

        return ordered;
    })();

    const candidates = [];

    if (/^\/\//.test(image)) {
        candidates.push(`https:${image}`);
        return Array.from(new Set(candidates));
    }

    if (/^https?:\/\//i.test(image)) {
        candidates.push(image);
        return Array.from(new Set(candidates));
    }

    if (image.startsWith('/')) {
        for (const origin of assetOrigins) {
            candidates.push(`${origin}${image}`);
            candidates.push(`${origin}/static/internalapi/asset${image}`);
        }
    } else {
        for (const origin of assetOrigins) {
            candidates.push(`${origin}/${image}`);
            candidates.push(`${origin}/static/internalapi/asset/${image}`);
            candidates.push(`${origin}/upload/${image}`);
            candidates.push(`${origin}/tx/${image}`);
        }
    }

    return Array.from(new Set(candidates));
}

function isNoSuchKeyError(error) {
    const status = Number(error?.status || error?.response?.status || 0);
    const rawBody = String(
        error?.responseData?.raw
        || error?.response?.data?.raw
        || error?.message
        || ''
    );

    return status === 404
        && (/NoSuchKey/i.test(rawBody) || /The specified key does not exist/i.test(rawBody));
}

function extractWorkSourcePayload(payload) {
    if (payload === null || payload === undefined) return null;

    if (typeof payload === 'string') return payload;

    if (typeof payload?.data === 'string') return payload.data;

    if (payload?.data?.source !== undefined) return payload.data.source;
    if (payload?.data?.work !== undefined) return payload.data.work;
    if (payload?.data?.project !== undefined) return payload.data.project;

    if (payload?.source !== undefined) return payload.source;
    if (payload?.work !== undefined) return payload.work;

    if (payload?.data !== undefined) return payload.data;
    return payload;
}

class Mirror40CodeSyncService {
    async getConfig() {
        const enabled = await zcconfig.get('mirror40code.enabled', false);
        const token = await zcconfig.get('mirror40code.token', '');
        const baseUrl = String(await zcconfig.get('mirror40code.base_url', 'https://api.abc.520gxx.com')).replace(/\/+$/, '');
        const timeoutMs = Number(await zcconfig.get('mirror40code.timeout_ms', 15000)) || 15000;
        const listLimit = Number(await zcconfig.get('mirror40code.work_user_l', 20)) || 20;
        const maxPages = Number(await zcconfig.get('mirror40code.max_pages', 50)) || 50;

        return { enabled, token, baseUrl, timeoutMs, listLimit, maxPages };
    }

    ensureEnabled(cfg) {
        if (!cfg.enabled) {
            throw new Error('mirror40code 同步未启用，请先设置 mirror40code.enabled=true');
        }
        if (!cfg.token) {
            throw new Error('mirror40code.token 未配置');
        }
    }

    async requestJson(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
        const requestPayload = typeof body === 'string' ? (() => {
            try {
                return JSON.parse(body);
            } catch {
                return body;
            }
        })() : body;

        logger.debug(`[mirror-40code] API request ${method.toUpperCase()} ${sanitizeUrlForLog(url)} payload=${truncateForLog(requestPayload, 1000)}`);

        try {
            const response = await axios({
                url,
                method,
                headers,
                data: requestPayload,
                timeout: timeoutMs,
                validateStatus: () => true,
            });

            let parsed = response.data;
            if (typeof parsed === 'string') {
                try {
                    parsed = JSON.parse(parsed);
                } catch {
                    parsed = { raw: parsed };
                }
            }

            logger.debug(`[mirror-40code] API response ${method.toUpperCase()} ${sanitizeUrlForLog(url)} status=${response.status} data=${truncateForLog(parsed, 2000)}`);

            if (response.status < 200 || response.status >= 300) {
                const requestError = new Error(`请求失败 ${response.status}: ${truncateForLog(parsed, 500)}`);
                requestError.status = response.status;
                requestError.responseData = parsed;
                requestError.requestUrl = url;
                requestError.requestMethod = method;
                throw requestError;
            }

            return parsed ?? {};
        } catch (error) {
            if (error?.response) {
                logger.error(`[mirror-40code] API error ${method.toUpperCase()} ${sanitizeUrlForLog(url)} status=${error.response.status} body=${truncateForLog(error.response.data, 1500)}`);
            } else {
                logger.error(`[mirror-40code] API error ${method.toUpperCase()} ${sanitizeUrlForLog(url)} message=${error.message}`);
            }
            throw error;
        }
    }

    async downloadImageBuffer(url, timeoutMs, purpose = '图片') {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: timeoutMs,
            maxContentLength: MAX_AVATAR_DOWNLOAD_SIZE,
            validateStatus: () => true,
            headers: {
                Accept: 'image/*,*/*;q=0.8',
                'User-Agent': 'ZeroCat-Mirror40Code/1.0',
            },
        });

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`${purpose}下载失败: HTTP ${response.status}`);
        }

        const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
        const buffer = Buffer.from(response.data || '');

        if (!buffer || buffer.length === 0) {
            throw new Error(`${purpose}下载失败: 空内容`);
        }

        if (buffer.length > MAX_AVATAR_DOWNLOAD_SIZE) {
            throw new Error(`${purpose}下载失败: 大小超过限制 ${MAX_AVATAR_DOWNLOAD_SIZE}`);
        }

        return { buffer, contentType };
    }

    async syncProxyUserAvatar(cfg, remoteUser, localUser) {
        const candidates = buildAvatarUrlCandidates(cfg.baseUrl, remoteUser);
        if (candidates.length === 0) {
            return { updated: false, reason: 'avatar_missing' };
        }

        let lastError = null;
        for (const avatarUrl of candidates) {
            try {
                const { buffer, contentType } = await this.downloadImageBuffer(avatarUrl, cfg.timeoutMs, '头像');
                const file = {
                    buffer,
                    originalname: buildAvatarFilename(remoteUser?.head || remoteUser?.avatar || avatarUrl),
                    mimetype: contentType || 'application/octet-stream',
                };

                const fakeRes = { locals: { userid: localUser.id } };
                const uploadResult = await uploadFile(
                    file,
                    {
                        purpose: 'avatar',
                        category: 'avatars',
                        tags: 'mirror40code-avatar',
                    },
                    fakeRes,
                    'mirror40code-sync',
                    'ZeroCat-Mirror40Code/1.0'
                );

                const avatarMd5 = String(uploadResult?.asset?.md5 || '');
                if (!avatarMd5) {
                    throw new Error('头像上传后未返回MD5');
                }

                if (localUser.avatar === avatarMd5 && localUser.images === avatarMd5) {
                    return {
                        updated: false,
                        avatar: avatarMd5,
                        sourceUrl: avatarUrl,
                    };
                }

                await prisma.ow_users.update({
                    where: { id: localUser.id },
                    data: {
                        avatar: avatarMd5,
                        images: avatarMd5,
                    },
                });

                localUser.avatar = avatarMd5;
                localUser.images = avatarMd5;

                logger.info(`[mirror-40code] 用户头像同步成功 remoteUser=${remoteUser?.id} localUser=${localUser.id} avatar=${avatarMd5} url=${avatarUrl}`);
                return {
                    updated: true,
                    avatar: avatarMd5,
                    sourceUrl: avatarUrl,
                };
            } catch (error) {
                lastError = error;
                logger.warn(`[mirror-40code] 用户头像同步候选失败 remoteUser=${remoteUser?.id} localUser=${localUser.id} url=${sanitizeUrlForLog(avatarUrl)} error=${error.message}`);
            }
        }

        logger.warn(`[mirror-40code] 用户头像同步失败 remoteUser=${remoteUser?.id} localUser=${localUser.id} candidates=${candidates.length} lastError=${lastError?.message || 'unknown'}`);
        return {
            updated: false,
            reason: 'avatar_sync_failed',
            error: lastError?.message || 'unknown',
        };
    }

    async syncProjectThumbnail(cfg, remoteProject, localProject, localAuthorId) {
        const candidates = buildProjectCoverUrlCandidates(cfg.baseUrl, remoteProject);
        if (candidates.length === 0) {
            return { updated: false, reason: 'thumbnail_missing' };
        }

        let lastError = null;
        for (const coverUrl of candidates) {
            try {
                const { buffer, contentType } = await this.downloadImageBuffer(coverUrl, cfg.timeoutMs, '封面');
                const file = {
                    buffer,
                    originalname: buildAssetFileName(remoteProject?.image || coverUrl, 'thumbnail'),
                    mimetype: contentType || 'application/octet-stream',
                };

                const fakeRes = { locals: { userid: localAuthorId || null } };
                const uploadResult = await uploadFile(
                    file,
                    {
                        purpose: 'general',
                        category: 'images',
                        tags: 'mirror40code-thumbnail',
                        imageOptions: {
                            quality: 90,
                            maxWidth: 1024,
                            maxHeight: 1024,
                        },
                    },
                    fakeRes,
                    'mirror40code-sync',
                    'ZeroCat-Mirror40Code/1.0'
                );

                const md5 = String(uploadResult?.asset?.md5 || '');
                const extension = String(uploadResult?.asset?.extension || 'webp');
                if (!md5) {
                    throw new Error('封面上传后未返回MD5');
                }

                const thumbnailFilename = `${md5}.${extension}`;
                if (String(localProject?.thumbnail || '') === thumbnailFilename) {
                    return {
                        updated: false,
                        thumbnail: thumbnailFilename,
                        sourceUrl: coverUrl,
                    };
                }

                await prisma.ow_projects.update({
                    where: { id: localProject.id },
                    data: { thumbnail: thumbnailFilename },
                });
                localProject.thumbnail = thumbnailFilename;

                logger.info(`[mirror-40code] 项目封面同步成功 remoteProject=${remoteProject?.id} localProject=${localProject.id} thumbnail=${thumbnailFilename} url=${coverUrl}`);
                return {
                    updated: true,
                    thumbnail: thumbnailFilename,
                    sourceUrl: coverUrl,
                };
            } catch (error) {
                lastError = error;
                logger.warn(`[mirror-40code] 项目封面同步候选失败 remoteProject=${remoteProject?.id} localProject=${localProject?.id} url=${sanitizeUrlForLog(coverUrl)} error=${error.message}`);
            }
        }

        logger.warn(`[mirror-40code] 项目封面同步失败 remoteProject=${remoteProject?.id} localProject=${localProject?.id} candidates=${candidates.length} lastError=${lastError?.message || 'unknown'}`);
        return {
            updated: false,
            reason: 'thumbnail_sync_failed',
            error: lastError?.message || 'unknown',
        };
    }

    async fetchSearchTopUsers(cfg, page = 1) {
        const url = `${cfg.baseUrl}/search/?token=${encodeURIComponent(cfg.token)}`;
        const pageValue = Number.isFinite(Number(page)) && Number(page) > 0
            ? String(Number(page))
            : '1';
        const body = {
            ...USER_SEARCH_PAYLOAD,
            page: pageValue,
        };

        const payload = await this.requestJson(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(body),
            timeoutMs: cfg.timeoutMs,
        });

        const code = Number(payload?.code);
        if (Number.isFinite(code) && code !== 1) {
            throw new Error(`/search 用户查询失败 code=${code} msg=${String(payload?.msg || '')}`);
        }

        const users = extractUserList(payload);
        const total = Number(payload?.data?.num);
        if (users.length === 0) {
            logger.warn(`[mirror-40code] /search 用户列表为空 page=${pageValue} payloadKeys=${Object.keys(payload || {}).join(',')} dataKeys=${Object.keys(payload?.data || {}).join(',')}`);
        }
        return {
            payload,
            users,
            page: Number(pageValue),
            total: Number.isFinite(total) && total > 0 ? total : null,
        };
    }

    async fetchUserInfo(cfg, userId) {
        const url = `${cfg.baseUrl}/user/info?id=${encodeURIComponent(String(userId))}&token=${encodeURIComponent(cfg.token)}`;
        const payload = await this.requestJson(url, { timeoutMs: cfg.timeoutMs });
        const user = Array.isArray(payload?.data) ? payload.data[0] : null;
        return { payload, user };
    }

    async fetchUserWorkList(cfg, userId) {
        const url = `${cfg.baseUrl}/work/user?id=${encodeURIComponent(String(userId))}&l=${encodeURIComponent(String(cfg.listLimit))}`;
        const payload = await this.requestJson(url, { timeoutMs: cfg.timeoutMs });
        const list = extractProjectList(payload);
        return { payload, list };
    }

    async fetchSearchProjectsByAuthor(cfg, userId, page) {
        const url = `${cfg.baseUrl}/search/?token=${encodeURIComponent(cfg.token)}`;
        const body = {
            ...PROJECT_SEARCH_PAYLOAD,
            author: String(userId),
            page: String(page),
        };
        const payload = await this.requestJson(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(body),
            timeoutMs: cfg.timeoutMs,
        });

        const list = extractProjectList(payload);
        return { payload, list };
    }

    async fetchWorkInfo(cfg, projectId) {
        const url = `${cfg.baseUrl}/work/info?id=${encodeURIComponent(String(projectId))}`;
        const payload = await this.requestJson(url, { timeoutMs: cfg.timeoutMs });
        return { payload, project: payload?.data || null };
    }

    async fetchWorkSource(cfg, projectId) {
        const url = `${cfg.baseUrl}/work/work?id=${encodeURIComponent(String(projectId))}&token=${encodeURIComponent(cfg.token)}&sha=null&etime=null`;
        let payload;
        try {
            payload = await this.requestJson(url, { timeoutMs: cfg.timeoutMs });
        } catch (error) {
            if (isNoSuchKeyError(error)) {
                logger.warn(`[mirror-40code] work source missing project=${projectId} reason=NoSuchKey`);
                return { payload: error?.responseData || null, source: null, missing: true };
            }
            throw error;
        }

        const source = extractWorkSourcePayload(payload);
        const sourcePreview = typeof source === 'string'
            ? source.slice(0, 120)
            : truncateForLog(source, 120);
        logger.info(`[mirror-40code] work source extracted project=${projectId} type=${typeof source} preview=${sourcePreview}`);
        return { payload, source, missing: false };
    }

    async getMappedLocalUserId(remoteUserId) {
        const record = await prisma.ow_target_configs.findUnique({
            where: {
                target_type_target_id_key: {
                    target_type: TARGET_TYPE_USER,
                    target_id: String(remoteUserId),
                    key: TARGET_KEY_LOCAL_USER_ID,
                },
            },
            select: { value: true },
        });
        const id = Number(record?.value);
        return Number.isFinite(id) && id > 0 ? id : null;
    }

    async upsertUserMapping(remoteUserId, localUserId) {
        await prisma.ow_target_configs.upsert({
            where: {
                target_type_target_id_key: {
                    target_type: TARGET_TYPE_USER,
                    target_id: String(remoteUserId),
                    key: TARGET_KEY_LOCAL_USER_ID,
                },
            },
            update: { value: String(localUserId) },
            create: {
                target_type: TARGET_TYPE_USER,
                target_id: String(remoteUserId),
                key: TARGET_KEY_LOCAL_USER_ID,
                value: String(localUserId),
            },
        });
    }

    async upsertProjectMapping(remoteProjectId, localProjectId) {
        await prisma.ow_target_configs.upsert({
            where: {
                target_type_target_id_key: {
                    target_type: TARGET_TYPE_PROJECT,
                    target_id: String(remoteProjectId),
                    key: TARGET_KEY_LOCAL_PROJECT_ID,
                },
            },
            update: { value: String(localProjectId) },
            create: {
                target_type: TARGET_TYPE_PROJECT,
                target_id: String(remoteProjectId),
                key: TARGET_KEY_LOCAL_PROJECT_ID,
                value: String(localProjectId),
            },
        });
    }

    async upsertProjectSyncMarker(localProjectId, markerKey, markerValue) {
        await prisma.ow_target_configs.upsert({
            where: {
                target_type_target_id_key: {
                    target_type: 'project',
                    target_id: String(localProjectId),
                    key: markerKey,
                },
            },
            update: {
                value: String(markerValue),
            },
            create: {
                target_type: 'project',
                target_id: String(localProjectId),
                key: markerKey,
                value: String(markerValue),
            },
        });
    }

    async markSyncedProject(localProjectId, { remoteProjectId = null, remoteUserId = null, isProfileArticle = false } = {}) {
        const tasks = [
            this.upsertProjectSyncMarker(localProjectId, 'mirror40.synced', 'true'),
            this.upsertProjectSyncMarker(localProjectId, 'mirror40.source', '40code'),
            this.upsertProjectSyncMarker(localProjectId, 'mirror40.profile_article', isProfileArticle ? 'true' : 'false'),
        ];

        if (Number.isFinite(Number(remoteProjectId)) && Number(remoteProjectId) > 0) {
            tasks.push(this.upsertProjectSyncMarker(localProjectId, 'mirror40.remote_project_id', String(remoteProjectId)));
        }

        if (Number.isFinite(Number(remoteUserId)) && Number(remoteUserId) > 0) {
            tasks.push(this.upsertProjectSyncMarker(localProjectId, 'mirror40.remote_user_id', String(remoteUserId)));
        }

        await Promise.all(tasks);
    }

    async getMappedProfileArticleProjectId(remoteUserId) {
        const record = await prisma.ow_target_configs.findUnique({
            where: {
                target_type_target_id_key: {
                    target_type: TARGET_TYPE_USER,
                    target_id: String(remoteUserId),
                    key: TARGET_KEY_LOCAL_PROFILE_PROJECT_ID,
                },
            },
            select: { value: true },
        });

        const id = Number(record?.value);
        return Number.isFinite(id) && id > 0 ? id : null;
    }

    async upsertProfileArticleProjectMapping(remoteUserId, localProjectId) {
        await prisma.ow_target_configs.upsert({
            where: {
                target_type_target_id_key: {
                    target_type: TARGET_TYPE_USER,
                    target_id: String(remoteUserId),
                    key: TARGET_KEY_LOCAL_PROFILE_PROJECT_ID,
                },
            },
            update: { value: String(localProjectId) },
            create: {
                target_type: TARGET_TYPE_USER,
                target_id: String(remoteUserId),
                key: TARGET_KEY_LOCAL_PROFILE_PROJECT_ID,
                value: String(localProjectId),
            },
        });
    }

    async ensureProxyUser(remoteUser, cfg) {
        const remoteId = Number(remoteUser?.id);
        if (!Number.isFinite(remoteId) || remoteId <= 0) {
            throw new Error('远程用户ID无效');
        }

        const mappedUserId = await this.getMappedLocalUserId(remoteId);
        const username = `${remoteId}@40code.com`;
        const legacyUsername = `m40u_${remoteId}`;
        const email = `${remoteId}@40code.com`;
        const displayName = sanitizeDisplayName(remoteUser?.nickname, username);
        const remoteBio = truncateText(String(remoteUser?.introduce || ''), 1000);

        const baseData = {
            email,
            display_name: displayName,
            status: 'active',
            type: 'user',
            bio: remoteBio,
        };

        let user = null;

        if (mappedUserId) {
            user = await prisma.ow_users.findUnique({ where: { id: mappedUserId } });
        }

        if (!user) {
            user = await prisma.ow_users.findUnique({ where: { username } });
        }

        if (!user) {
            user = await prisma.ow_users.findUnique({ where: { username: legacyUsername } });
        }

        if (!user) {
            user = await prisma.ow_users.findFirst({ where: { email } });
        }

        if (!user) {
            user = await prisma.ow_users.create({
                data: {
                    username,
                    ...baseData,
                    regTime: new Date(),
                    loginTime: new Date(),
                },
            });
        } else {
            const updateData = { ...baseData };

            if (user.username !== username) {
                const usernameOwner = await prisma.ow_users.findUnique({
                    where: { username },
                    select: { id: true },
                });

                if (!usernameOwner || usernameOwner.id === user.id) {
                    updateData.username = username;
                } else {
                    logger.warn(`[mirror-40code] 用户名迁移冲突 remoteUser=${remoteId} target=${username} owner=${usernameOwner.id}`);
                }
            }

            user = await prisma.ow_users.update({
                where: { id: user.id },
                data: updateData,
            });
        }

        await this.upsertUserMapping(remoteId, user.id);

        if (cfg) {
            await this.syncProxyUserAvatar(cfg, remoteUser, user).catch((error) => {
                logger.warn(`[mirror-40code] 用户头像同步异常 remoteUser=${remoteId} localUser=${user.id} error=${error.message}`);
            });
        }

        return user;
    }

    async ensureProfileArticleProject(remoteUser, localUser) {
        const remoteUserId = Number(remoteUser?.id);
        if (!Number.isFinite(remoteUserId) || remoteUserId <= 0) {
            throw new Error('远程用户ID无效，无法创建简介镜像项目');
        }

        const mappedProjectId = await this.getMappedProfileArticleProjectId(remoteUserId);
        const projectName = `${remoteUserId}@40code.com`;
        const legacyProjectName = `m40u_${remoteUserId}`;
        const projectTitle = truncateText(`${localUser.display_name || projectName} 的40code简介`, 1000);
        const articleDescription = truncateText(`40code用户简介镜像\n远端用户ID: ${remoteUserId}`, 1000);

        let project = null;
        if (mappedProjectId) {
            project = await prisma.ow_projects.findUnique({ where: { id: mappedProjectId } });
        }

        if (!project) {
            project = await prisma.ow_projects.findFirst({
                where: {
                    authorid: localUser.id,
                    name: { in: [projectName, legacyProjectName] },
                    type: 'article',
                },
            });
        }

        const data = {
            name: projectName,
            title: projectTitle,
            description: articleDescription,
            type: 'article',
            state: 'public',
            authorid: localUser.id,
            default_branch: 'main',
            history: true,
            time: new Date(),
        };

        if (!project) {
            project = await prisma.ow_projects.create({ data });
        } else {
            project = await prisma.ow_projects.update({
                where: { id: project.id },
                data,
            });
        }

        await this.upsertProfileArticleProjectMapping(remoteUserId, project.id);
        await this.markSyncedProject(project.id, {
            remoteUserId,
            isProfileArticle: true,
        });

        const introSource = String(remoteUser?.introduce ?? '');
        const articleSource = introSource.length > 0 ? introSource : ' ';
        await this.saveProjectSourceAndCommit(project, localUser.id, { id: `user-${remoteUserId}` }, articleSource);

        return project;
    }

    async collectUserProjectIds(cfg, remoteUserId) {
        const ids = new Set();

        const workListResult = await this.fetchUserWorkList(cfg, remoteUserId);
        for (const item of workListResult.list) {
            const projectId = Number(item?.id);
            if (Number.isFinite(projectId) && projectId > 0) ids.add(projectId);
        }

        for (let page = 1; page <= cfg.maxPages; page++) {
            const result = await this.fetchSearchProjectsByAuthor(cfg, remoteUserId, page);
            const list = result.list;
            if (!Array.isArray(list) || list.length === 0) break;

            let pageAdded = 0;
            for (const item of list) {
                const projectId = Number(item?.id);
                if (!Number.isFinite(projectId) || projectId <= 0) continue;
                if (!ids.has(projectId)) {
                    ids.add(projectId);
                    pageAdded += 1;
                }
            }

            if (pageAdded === 0) break;
        }

        return Array.from(ids);
    }

    async syncUser(remoteUserId) {
        const cfg = await this.getConfig();
        this.ensureEnabled(cfg);

        const parsedUserId = Number(remoteUserId);
        if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
            throw new Error(`无效远程用户ID: ${remoteUserId}`);
        }

        const { user: remoteUser } = await this.fetchUserInfo(cfg, parsedUserId);
        if (!remoteUser) {
            throw new Error(`远程用户不存在或无法获取: ${parsedUserId}`);
        }

        const localUser = await this.ensureProxyUser(remoteUser, cfg);
        const profileArticleProject = await this.ensureProfileArticleProject(remoteUser, localUser);
        const projectIds = await this.collectUserProjectIds(cfg, parsedUserId);

        return {
            remoteUserId: parsedUserId,
            localUserId: localUser.id,
            profileArticleProjectId: profileArticleProject.id,
            projectIds,
            displayName: localUser.display_name,
        };
    }

    async getMappedLocalProjectId(remoteProjectId) {
        const record = await prisma.ow_target_configs.findUnique({
            where: {
                target_type_target_id_key: {
                    target_type: TARGET_TYPE_PROJECT,
                    target_id: String(remoteProjectId),
                    key: TARGET_KEY_LOCAL_PROJECT_ID,
                },
            },
            select: { value: true },
        });
        const id = Number(record?.value);
        return Number.isFinite(id) && id > 0 ? id : null;
    }

    buildProjectMetadata(remoteProject, localAuthorId) {
        const remoteProjectId = Number(remoteProject?.id);
        const projectName = truncateText(String(remoteProject?.name || `40code-${remoteProjectId}`), 128);

        return {
            name: `${remoteProjectId}`,
            title: truncateText(projectName, 1000),
            description: truncateText(String(remoteProject?.introduce || `40code镜像作品 ${remoteProjectId}`), 1000),
            type: 'scratch',
            state: 'public',
            authorid: localAuthorId,
            default_branch: 'main',
            view_count: Number(remoteProject?.look) || 0,
            like_count: Number(remoteProject?.like) || 0,
            favo_count: Number(remoteProject?.num_collections) || 0,
            star_count: Number(remoteProject?.like) || 0,
            time: toDateFromUnixSeconds(remoteProject?.publish_time || remoteProject?.time) || new Date(),
            history: true,
        };
    }

    async ensureMirrorProject(remoteProject, localAuthorId, remoteAuthorId = null) {
        const remoteProjectId = Number(remoteProject?.id);
        if (!Number.isFinite(remoteProjectId) || remoteProjectId <= 0) {
            throw new Error('远程项目ID无效');
        }

        const metadata = this.buildProjectMetadata(remoteProject, localAuthorId);
        const mappedProjectId = await this.getMappedLocalProjectId(remoteProjectId);

        let project = null;
        if (mappedProjectId) {
            project = await prisma.ow_projects.findUnique({ where: { id: mappedProjectId } });
        }

        if (!project) {
            project = await prisma.ow_projects.findFirst({
                where: {
                    name: metadata.name,
                    authorid: localAuthorId,
                },
            });
        }

        if (!project) {
            project = await prisma.ow_projects.create({ data: metadata });
        } else {
            project = await prisma.ow_projects.update({
                where: { id: project.id },
                data: metadata,
            });
        }

        await this.upsertProjectMapping(remoteProjectId, project.id);
        await this.markSyncedProject(project.id, {
            remoteProjectId,
            remoteUserId: remoteAuthorId,
            isProfileArticle: false,
        });
        return project;
    }

    async saveProjectSourceAndCommit(localProject, localAuthorId, remoteProject, rawSource) {
        const source = stringifySource(rawSource);
        if (!source || source.length === 0) {
            throw new Error(`远程项目 ${remoteProject?.id} 源码为空`);
        }

        const sourceSha = hashSource(source);

        await prisma.ow_projects_file.upsert({
            where: { sha256: sourceSha },
            update: {},
            create: {
                sha256: sourceSha,
                source,
                create_userid: localAuthorId,
            },
        });

        const branch = 'main';
        const latestCommit = await prisma.ow_projects_commits.findFirst({
            where: {
                project_id: localProject.id,
                branch,
            },
            orderBy: { commit_date: 'desc' },
            select: {
                id: true,
                commit_file: true,
            },
        });

        if (latestCommit?.commit_file === sourceSha) {
            return {
                updated: false,
                commitId: latestCommit.id,
                sourceSha,
            };
        }

        const now = new Date();
        const isFirstCommit = !latestCommit;
        const commitMessage = isFirstCommit
            ? '初始化提交'
            : `40code镜像同步 #${remoteProject?.id}`;
        const commitId = buildCommitId({
            sourceSha,
            projectId: localProject.id,
            remoteProjectId: remoteProject?.id,
            remoteVersion: remoteProject?.version,
            at: now.toISOString(),
        });

        await prisma.$transaction(async (tx) => {
            await tx.ow_projects_commits.create({
                data: {
                    id: commitId,
                    project_id: localProject.id,
                    author_id: localAuthorId,
                    branch,
                    parent_commit_id: latestCommit?.id || null,
                    commit_file: sourceSha,
                    commit_message: commitMessage,
                    commit_description: isFirstCommit
                        ? '# 初始化提交'
                        : truncateText(`自动镜像同步\n远端项目ID: ${remoteProject?.id}\n远端更新时间: ${remoteProject?.update_time || ''}`, 1000),
                    commit_date: now,
                },
            });

            await tx.ow_projects_branch.upsert({
                where: {
                    projectid_name: {
                        projectid: localProject.id,
                        name: branch,
                    },
                },
                update: {
                    latest_commit_hash: commitId,
                },
                create: {
                    projectid: localProject.id,
                    name: branch,
                    latest_commit_hash: commitId,
                    creator: localAuthorId,
                    description: '镜像默认分支',
                },
            });

            await tx.ow_projects.update({
                where: { id: localProject.id },
                data: {
                    default_branch: branch,
                },
            });
        });

        return {
            updated: true,
            commitId,
            sourceSha,
        };
    }

    async ensureAuthorByRemoteId(cfg, remoteUserId) {
        const id = Number(remoteUserId);
        if (!Number.isFinite(id) || id <= 0) {
            throw new Error(`远程作者ID无效: ${remoteUserId}`);
        }

        let mappedUser = null;
        const mappedUserId = await this.getMappedLocalUserId(id);
        if (mappedUserId) {
            mappedUser = await prisma.ow_users.findUnique({ where: { id: mappedUserId } });
        }

        try {
            const { user: remoteUser } = await this.fetchUserInfo(cfg, id);
            if (!remoteUser) {
                if (mappedUser) {
                    logger.warn(`[mirror-40code] 作者远端信息为空，使用本地映射用户 remoteUser=${id} localUser=${mappedUser.id}`);
                    return mappedUser;
                }
                throw new Error(`无法拉取作者信息: ${id}`);
            }
            return this.ensureProxyUser(remoteUser, cfg);
        } catch (error) {
            if (mappedUser) {
                logger.warn(`[mirror-40code] 作者信息刷新失败，使用本地映射用户 remoteUser=${id} localUser=${mappedUser.id} error=${error.message}`);
                return mappedUser;
            }
            throw error;
        }
    }

    async syncProject(remoteProjectId, remoteAuthorHint = null) {
        const cfg = await this.getConfig();
        this.ensureEnabled(cfg);

        const parsedProjectId = Number(remoteProjectId);
        if (!Number.isFinite(parsedProjectId) || parsedProjectId <= 0) {
            throw new Error(`无效远程项目ID: ${remoteProjectId}`);
        }

        const { project: remoteProject } = await this.fetchWorkInfo(cfg, parsedProjectId);
        if (!remoteProject || Number(remoteProject?.id) !== parsedProjectId) {
            return {
                remoteProjectId: parsedProjectId,
                skipped: true,
                reason: 'not_found',
            };
        }

        const remoteAuthorId = Number(remoteProject?.author || remoteAuthorHint);
        const localAuthor = await this.ensureAuthorByRemoteId(cfg, remoteAuthorId);
        const localProject = await this.ensureMirrorProject(remoteProject, localAuthor.id, remoteAuthorId);

        await this.syncProjectThumbnail(cfg, remoteProject, localProject, localAuthor.id).catch((error) => {
            logger.warn(`[mirror-40code] 项目封面同步异常 remoteProject=${parsedProjectId} localProject=${localProject.id} error=${error.message}`);
        });

        const { source, missing } = await this.fetchWorkSource(cfg, parsedProjectId);
        if (missing) {
            return {
                remoteProjectId: parsedProjectId,
                remoteAuthorId,
                localAuthorId: localAuthor.id,
                localProjectId: localProject.id,
                skipped: true,
                reason: 'source_not_found',
            };
        }

        if (source === null || source === undefined || source === '') {
            return {
                remoteProjectId: parsedProjectId,
                remoteAuthorId,
                localAuthorId: localAuthor.id,
                localProjectId: localProject.id,
                skipped: true,
                reason: 'source_empty',
            };
        }

        const commitResult = await this.saveProjectSourceAndCommit(localProject, localAuthor.id, remoteProject, source);

        return {
            remoteProjectId: parsedProjectId,
            remoteAuthorId,
            localAuthorId: localAuthor.id,
            localProjectId: localProject.id,
            updated: commitResult.updated,
            commitId: commitResult.commitId,
            sourceSha: commitResult.sourceSha,
        };
    }

    async collectTopUserIds() {
        const cfg = await this.getConfig();
        this.ensureEnabled(cfg);

        let firstPage = await this.fetchSearchTopUsers(cfg, 1);
        if (!Array.isArray(firstPage.users) || firstPage.users.length === 0) {
            for (let attempt = 2; attempt <= 3; attempt++) {
                logger.warn(`[mirror-40code] 首页面用户为空，重试第 ${attempt - 1} 次`);
                firstPage = await this.fetchSearchTopUsers(cfg, 1);
                if (Array.isArray(firstPage.users) && firstPage.users.length > 0) {
                    break;
                }
            }
        }

        if (!Array.isArray(firstPage.users) || firstPage.users.length === 0) {
            throw new Error('[mirror-40code] 全量用户抓取失败：首页面返回空用户列表，已重试');
        }

        const allIds = new Set(
            firstPage.users
                .map((item) => Number(item?.id))
                .filter((id) => Number.isFinite(id) && id > 0)
        );

        const firstPageSize = firstPage.users.length;
        const estimatedTotalPages = firstPage.total && firstPageSize > 0
            ? Math.ceil(firstPage.total / firstPageSize)
            : 1;
        const pageLimit = Math.max(1, estimatedTotalPages, cfg.maxPages || 1);

        for (let page = 2; page <= pageLimit; page++) {
            const result = await this.fetchSearchTopUsers(cfg, page);
            if (!Array.isArray(result.users) || result.users.length === 0) {
                logger.info(`[mirror-40code] 用户分页到第 ${page} 页为空，提前结束抓取`);
                break;
            }

            let added = 0;
            for (const item of result.users) {
                const id = Number(item?.id);
                if (!Number.isFinite(id) || id <= 0) continue;
                if (!allIds.has(id)) {
                    allIds.add(id);
                    added += 1;
                }
            }

            if (added === 0) {
                logger.info(`[mirror-40code] 用户分页到第 ${page} 页未新增用户，提前结束抓取`);
                break;
            }
        }

        const uniqueIds = Array.from(allIds);
        logger.info(`[mirror-40code] 全量用户抓取完成，统计总数=${firstPage.total || 'unknown'} 有效ID=${uniqueIds.length}`);
        return uniqueIds;
    }

    async pingRemote() {
        const cfg = await this.getConfig();
        this.ensureEnabled(cfg);
        const url = `${cfg.baseUrl}/search/?token=${encodeURIComponent(cfg.token)}`;
        const payload = await this.requestJson(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(USER_SEARCH_PAYLOAD),
            timeoutMs: cfg.timeoutMs,
        });
        logger.debug(`[mirror-40code] pingRemote payload=${truncateForLog(payload, 1500)}`);
        return {
            ok: payload?.code === 1 || Boolean(payload?.data),
            code: payload?.code,
        };
    }
}

const mirror40CodeSyncService = new Mirror40CodeSyncService();

export default mirror40CodeSyncService;
