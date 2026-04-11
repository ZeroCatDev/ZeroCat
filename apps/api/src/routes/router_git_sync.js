import { Router } from 'express';
import crypto from 'crypto';
import { needLogin } from '../middleware/auth.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import redisClient from '../services/redis.js';
import logger from '../services/logger.js';
import { prisma } from '../services/prisma.js';
import zcconfig from '../services/config/zcconfig.js';
import { buildInstallUrl, createInstallationToken, getInstallationInfo } from '../services/gitSync/githubApp.js';
import { getRepo, listInstallationRepos, searchRepos } from '../services/gitSync/githubApi.js';
import { addUserGitLink, findUserGitLink, getProjectGitSyncSettings, getProjectGitSyncState, getUserGitLinks, removeUserGitLink, setProjectGitSyncState, updateProjectGitSyncSettings } from '../services/gitSync/storage.js';
import queueManager from '../services/queue/queueManager.js';

const router = Router();

const gitSyncRateLimit = createRateLimit({
    windowMs: 60 * 1000,
    max: 20,
    prefix: 'rate_limit:git_sync:',
    message: {
        status: 'error',
        message: 'Git同步请求过于频繁，请稍后再试',
    },
});

const parseBooleanInput = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
    if (typeof value !== 'string') return null;

    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on", "enable", "enabled"].includes(normalized)) return true;
    if (["0", "false", "no", "off", "disable", "disabled"].includes(normalized)) return false;
    return null;
};

const normalizeRepoValue = (value) => String(value || '').trim();

const sanitizeFilenameInput = (value) => {
    const name = String(value || '').trim();
    if (!name) return null;
    if (name.includes('..') || name.includes('/') || name.includes('\\')) return null;
    return name;
};


const resolveFrontendBaseUrl = async () => {
    const frontendUrl = await zcconfig.get('urls.frontend');
    if (!frontendUrl) return null;
    try {
        return new URL(frontendUrl);
    } catch (error) {
        logger.warn(`[git-sync] Invalid frontend URL: ${frontendUrl}`);
        return null;
    }
};

const resolveFrontendRedirect = async (redirectUrl, fallbackPath, fallbackParams) => {
    const base = await resolveFrontendBaseUrl();
    if (!base) return null;

    if (redirectUrl) {
        try {
            if (redirectUrl.startsWith('/')) {
                return new URL(redirectUrl, base).toString();
            }
            const candidate = new URL(redirectUrl);
            if (candidate.origin === base.origin) {
                return candidate.toString();
            }
        } catch (error) {
            logger.warn(`[git-sync] Invalid redirect URL: ${redirectUrl}`);
        }
    }

    const fallback = new URL(fallbackPath || '/', base);
    if (fallbackParams) {
        Object.entries(fallbackParams).forEach(([key, value]) => {
            if (value != null && value !== '') {
                fallback.searchParams.set(key, String(value));
            }
        });
    }
    return fallback.toString();
};

const listAllInstallationRepos = async (token) => {
    const perPage = 100;
    const maxPages = 10;
    let page = 1;
    let total = null;
    const repos = [];

    while (page <= maxPages) {
        const result = await listInstallationRepos(token, { perPage, page });
        const batch = Array.isArray(result?.repositories) ? result.repositories : [];
        repos.push(...batch);
        total = typeof result?.total_count === 'number' ? result.total_count : total;
        if (!batch.length) break;
        if (total != null && repos.length >= total) break;
        if (batch.length < perPage) break;
        page += 1;
    }

    return repos;
};

const ensureProjectOwner = async (projectId, userId) => {
    const project = await prisma.ow_projects.findFirst({
        where: { id: Number(projectId) },
        select: { id: true, authorid: true, default_branch: true, type: true },
    });
    if (!project) {
        const error = new Error('项目不存在');
        error.status = 404;
        throw error;
    }
    if (Number(project.authorid) !== Number(userId)) {
        const error = new Error('无权操作该项目');
        error.status = 403;
        throw error;
    }
    return project;
};

router.get('/links', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const links = await getUserGitLinks(res.locals.userid);
        res.status(200).send({ status: 'success', links });
    } catch (error) {
        next(error);
    }
});

router.delete('/links/:linkId', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const removed = await removeUserGitLink(res.locals.userid, req.params.linkId);
        if (!removed) {
            return res.status(404).send({ status: 'error', message: '链接不存在' });
        }
        res.status(200).send({ status: 'success' });
    } catch (error) {
        next(error);
    }
});

router.post('/github/app/install-url', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const state = crypto.randomUUID();
        const stateKey = `git-sync:github:state:${state}`;
        const redirectUrl = typeof req.body?.redirectUrl === 'string' ? req.body.redirectUrl.trim() : '';
        const stored = await redisClient.set(stateKey, {
            userId: res.locals.userid,
            createdAt: new Date().toISOString(),
            redirectUrl: redirectUrl || null,
        }, 600);
        if (!stored) {
            return res.status(500).send({ status: 'error', message: '无法创建安装状态' });
        }

        const url = await buildInstallUrl(state);
        res.status(200).send({ status: 'success', url, state });
    } catch (error) {
        next(error);
    }
});

router.get('/github/app/callback', gitSyncRateLimit, async (req, res, next) => {
    try {
        const installationId = Number(req.query.installation_id || req.query.installationId);
        const state = String(req.query.state || '').trim();

        if (!installationId || !state) {
            const redirectUrl = await resolveFrontendRedirect(null, '/app/account/oauth/bind/error', {
                message: '缺少安装参数',
            });
            if (redirectUrl) return res.redirect(redirectUrl);
            return res.status(400).send({ status: 'error', message: '缺少安装参数' });
        }

        const stateKey = `git-sync:github:state:${state}`;
        const stateData = await redisClient.get(stateKey);
        await redisClient.delete(stateKey);

        if (!stateData?.userId) {
            const redirectUrl = await resolveFrontendRedirect(null, '/app/account/oauth/bind/error', {
                message: '安装状态已过期',
            });
            if (redirectUrl) return res.redirect(redirectUrl);
            return res.status(400).send({ status: 'error', message: '安装状态已过期' });
        }

        const installation = await getInstallationInfo(installationId);
        const account = installation?.account || {};
        const link = await addUserGitLink(stateData.userId, {
            provider: 'github',
            kind: 'app',
            installationId,
            account: {
                id: account.id || null,
                login: account.login || null,
                type: account.type || null,
                avatar_url: account.avatar_url || null,
            },
            meta: {
                appId: installation?.app_id || null,
                targetType: installation?.target_type || null,
            },
        });

        const redirectUrl = await resolveFrontendRedirect(stateData.redirectUrl, '/app/account/oauth');
        if (redirectUrl) return res.redirect(redirectUrl);
        res.status(200).send({ status: 'success', link });
    } catch (error) {
        const redirectUrl = await resolveFrontendRedirect(null, '/app/account/oauth/bind/error', {
            message: 'GitHub App绑定失败',
        });
        if (redirectUrl) return res.redirect(redirectUrl);
        next(error);
    }
});

router.get('/github/app/installations/:linkId/repos', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const link = await findUserGitLink(res.locals.userid, req.params.linkId);
        if (!link?.installationId) {
            return res.status(404).send({ status: 'error', message: '链接不存在' });
        }

        const token = (await createInstallationToken(link.installationId)).token;
        if (!token) {
            return res.status(500).send({ status: 'error', message: '无法创建安装令牌' });
        }

        const repositories = await listAllInstallationRepos(token);
        res.status(200).send({ status: 'success', repositories });
    } catch (error) {
        next(error);
    }
});

router.get('/github/app/repos', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const links = await getUserGitLinks(res.locals.userid);
        if (!links.length) {
            return res.status(200).send({ status: 'success', repositories: [] });
        }

        const repoBatches = await Promise.all(links.map(async (link) => {
            if (!link?.installationId) return [];
            try {
                const token = (await createInstallationToken(link.installationId)).token;
                if (!token) return [];
                const repositories = await listAllInstallationRepos(token);
                return repositories.map((repo) => ({
                    ...repo,
                    gitLinkId: link.id,
                    gitInstallationId: link.installationId,
                    gitAccount: link.account || null,
                }));
            } catch (error) {
                logger.warn(`[git-sync] list repos failed for link ${link.id}: ${error.message}`);
                return [];
            }
        }));

        const merged = [];
        const seen = new Set();
        for (const batch of repoBatches) {
            for (const repo of batch) {
                const key = repo?.full_name || repo?.name;
                if (!key || seen.has(key)) continue;
                seen.add(key);
                merged.push(repo);
            }
        }

        res.status(200).send({ status: 'success', repositories: merged });
    } catch (error) {
        next(error);
    }
});

router.get('/github/app/repos/search', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const query = String(req.query.q || req.query.query || '').trim();
        if (!query) {
            return res.status(400).send({ status: 'error', message: '缺少搜索关键词' });
        }

        const perPage = Math.min(50, Math.max(1, Number(req.query.per_page) || 20));
        const page = Math.max(1, Number(req.query.page) || 1);

        const links = await getUserGitLinks(res.locals.userid);
        if (!links.length) {
            return res.status(200).send({ status: 'success', repositories: [] });
        }

        const repoBatches = await Promise.all(links.map(async (link) => {
            if (!link?.installationId) return [];
            try {
                const token = (await createInstallationToken(link.installationId)).token;
                if (!token) return [];
                const allowedRepos = await listAllInstallationRepos(token);
                const allowedMap = new Map(allowedRepos.map((repo) => [repo.full_name, repo]));
                const accountLogin = link?.account?.login;
                const accountType = String(link?.account?.type || '').toLowerCase();
                const scopedQuery = accountLogin
                    ? `${query} ${accountType === 'organization' ? `org:${accountLogin}` : `user:${accountLogin}`}`
                    : query;

                const result = await searchRepos(token, scopedQuery, { perPage, page });
                const items = Array.isArray(result?.items) ? result.items : [];
                const filtered = items.map((item) => {
                    const key = item?.full_name || (item?.owner?.login && item?.name ? `${item.owner.login}/${item.name}` : null);
                    if (!key || !allowedMap.has(key)) return null;
                    const repo = allowedMap.get(key);
                    return {
                        ...repo,
                        gitLinkId: link.id,
                        gitInstallationId: link.installationId,
                        gitAccount: link.account || null,
                    };
                }).filter(Boolean);

                return filtered;
            } catch (error) {
                logger.warn(`[git-sync] search repos failed for link ${link.id}: ${error.message}`);
                return [];
            }
        }));

        const merged = [];
        const seen = new Set();
        for (const batch of repoBatches) {
            for (const repo of batch) {
                const key = repo?.full_name || repo?.name;
                if (!key || seen.has(key)) continue;
                seen.add(key);
                merged.push(repo);
            }
        }

        res.status(200).send({ status: 'success', repositories: merged });
    } catch (error) {
        next(error);
    }
});


router.get('/projects/:projectId', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const project = await ensureProjectOwner(req.params.projectId, res.locals.userid);
        const settings = await getProjectGitSyncSettings(project.id);
        const state = await getProjectGitSyncState(project.id);
        res.status(200).send({
            status: 'success',
            settings,
            state,
            projectType: project.type,
            projectDefaultBranch: project.default_branch || 'main',
        });
    } catch (error) {
        next(error);
    }
});

router.post('/projects/:projectId/bind', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const project = await ensureProjectOwner(req.params.projectId, res.locals.userid);
        const {
            linkId,
            repoOwner,
            repoName,
            branch,
            fileName,
            includeReadme,
            enabled,
        } = req.body || {};

        const normalizedOwner = normalizeRepoValue(repoOwner);
        const normalizedRepo = normalizeRepoValue(repoName);
        if (!linkId || !normalizedOwner || !normalizedRepo) {
            return res.status(400).send({ status: 'error', message: '缺少绑定参数' });
        }

        const link = await findUserGitLink(res.locals.userid, linkId);
        if (!link?.installationId) {
            return res.status(404).send({ status: 'error', message: '链接不存在' });
        }

        const token = (await createInstallationToken(link.installationId)).token;
        if (!token) {
            return res.status(500).send({ status: 'error', message: '无法创建安装令牌' });
        }

        const repo = await getRepo(token, normalizedOwner, normalizedRepo);
        const parsedIncludeReadme = parseBooleanInput(includeReadme);
        const parsedEnabled = parseBooleanInput(enabled);
        const finalSettings = await updateProjectGitSyncSettings(project.id, {
            enabled: parsedEnabled === null ? true : parsedEnabled,
            provider: 'github',
            linkKind: 'app',
            linkId,
            repoOwner: normalizedOwner,
            repoName: normalizedRepo,
            branch: normalizeRepoValue(branch) || project.default_branch || repo?.default_branch || 'main',
            fileName: sanitizeFilenameInput(fileName) || undefined,
            includeReadme: parsedIncludeReadme === null ? true : parsedIncludeReadme,
            readmeFileName: undefined,
            disabledReason: null,
        });

        const currentState = await getProjectGitSyncState(project.id);
        await setProjectGitSyncState(project.id, {
            ...(currentState || {}),
            lastError: null,
            disabledReason: null,
        });

        res.status(200).send({ status: 'success', settings: finalSettings, repo });
    } catch (error) {
        logger.error('[git-sync] bind failed:', error.message);
        next(error);
    }
});

router.post('/projects/:projectId/unbind', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const project = await ensureProjectOwner(req.params.projectId, res.locals.userid);
        const settings = await updateProjectGitSyncSettings(project.id, {
            enabled: false,
            disabledReason: 'manual_unbind',
        });
        res.status(200).send({ status: 'success', settings });
    } catch (error) {
        next(error);
    }
});

router.post('/projects/:projectId/sync', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const project = await ensureProjectOwner(req.params.projectId, res.locals.userid);
        const latestCommit = await prisma.ow_projects_commits.findFirst({
            where: { project_id: project.id },
            orderBy: { commit_date: 'desc' },
            select: { id: true },
        });

        if (!latestCommit?.id) {
            return res.status(404).send({ status: 'error', message: '项目暂无提交' });
        }

        const result = await queueManager.enqueueGitSyncCommit(project.id, latestCommit.id, {
            triggeredBy: 'manual',
            actorId: res.locals.userid,
        });

        res.status(200).send({ status: 'success', result });
    } catch (error) {
        next(error);
    }
});

export default router;
