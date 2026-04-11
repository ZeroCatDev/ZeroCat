import { Router } from 'express';
import crypto from 'crypto';
import { needLogin } from '../middleware/auth.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import redisClient from '../services/redis.js';
import logger from '../services/logger.js';
import { prisma } from '../services/prisma.js';
import zcconfig from '../services/config/zcconfig.js';
import { buildInstallUrl, buildUserTokenAuthUrl, createInstallationToken, exchangeUserToken, getInstallationInfo } from '../services/gitSync/githubApp.js';
import { createOrgRepo, createUserRepo, getAuthenticatedUser, getRepo, listInstallationRepos, searchRepos } from '../services/gitSync/githubApi.js';
import { addUserGitLink, findUserGitHubUserToken, findUserGitLink, getProjectGitSyncSettings, getProjectGitSyncState, getUserGitHubUserTokens, getUserGitLinks, removeUserGitLink, setProjectGitSyncState, updateProjectGitSyncSettings, upsertUserGitHubUserToken } from '../services/gitSync/storage.js';
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

const sanitizeRepoNameInput = (value) => {
    const name = String(value || '').trim();
    if (!name) return null;
    if (name.length > 100) return null;
    if (name.includes('..') || name.includes('/') || name.includes('\\')) return null;
    if (!/^[0-9A-Za-z._-]+$/.test(name)) return null;
    return name;
};

const sanitizeDescriptionInput = (value) => {
    const description = String(value || '').trim();
    if (!description) return null;
    return description.slice(0, 200);
};

const normalizeAccountType = (value) => String(value || '').trim().toLowerCase();

const buildExpiresAt = (expiresIn) => {
    const seconds = Number(expiresIn);
    if (!seconds || Number.isNaN(seconds)) return null;
    return new Date(Date.now() + seconds * 1000).toISOString();
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
        select: { id: true, authorid: true, default_branch: true, type: true, name: true, title: true, state: true },
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
        const [links, tokens] = await Promise.all([
            getUserGitLinks(res.locals.userid),
            getUserGitHubUserTokens(res.locals.userid),
        ]);

        const tokenList = Array.isArray(tokens) ? tokens : [];

        const enhancedLinks = links.map((link) => {
            const accountId = String(link?.account?.id || '').trim();
            const accountLogin = String(link?.account?.login || '').trim();
            const token = tokenList.find((item) => (
                (accountId && String(item?.accountId || '').trim() === accountId)
                || (accountLogin && String(item?.accountLogin || '').trim().toLowerCase() === accountLogin.toLowerCase())
            ));
            return {
                ...link,
                userTokenBound: Boolean(token),
            };
        });

        res.status(200).send({ status: 'success', links: enhancedLinks });
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
        const parsedAutoUserToken = parseBooleanInput(req.body?.autoUserToken);
        const stored = await redisClient.set(stateKey, {
            userId: res.locals.userid,
            createdAt: new Date().toISOString(),
            redirectUrl: redirectUrl || null,
            autoUserToken: parsedAutoUserToken === null ? false : parsedAutoUserToken,
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

router.post('/github/app/user-token-url', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const state = crypto.randomUUID();
        const stateKey = `git-sync:github:user-token:state:${state}`;
        const redirectUrl = typeof req.body?.redirectUrl === 'string' ? req.body.redirectUrl.trim() : '';
        const linkId = String(req.body?.linkId || '').trim();

        let link = null;
        if (linkId) {
            link = await findUserGitLink(res.locals.userid, linkId);
            if (!link) {
                return res.status(404).send({ status: 'error', message: '链接不存在' });
            }
        }

        const stored = await redisClient.set(stateKey, {
            userId: res.locals.userid,
            createdAt: new Date().toISOString(),
            redirectUrl: redirectUrl || null,
            linkId: link?.id || null,
        }, 600);

        if (!stored) {
            return res.status(500).send({ status: 'error', message: '无法创建授权状态' });
        }

        const url = await buildUserTokenAuthUrl(state, {
            login: link?.account?.login || undefined,
        });
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

        const accountType = normalizeAccountType(account?.type);
        const shouldAutoUserToken = parseBooleanInput(stateData?.autoUserToken) === true;
        if (shouldAutoUserToken && accountType && accountType !== 'organization') {
            const existingToken = await findUserGitHubUserToken(
                stateData.userId,
                account?.id,
                account?.login
            );

            if (!existingToken) {
                const userTokenState = crypto.randomUUID();
                const userTokenStateKey = `git-sync:github:user-token:state:${userTokenState}`;
                const storedUserToken = await redisClient.set(userTokenStateKey, {
                    userId: stateData.userId,
                    createdAt: new Date().toISOString(),
                    redirectUrl: stateData.redirectUrl || null,
                    linkId: link?.id || null,
                }, 600);

                if (storedUserToken) {
                    try {
                        const userTokenUrl = await buildUserTokenAuthUrl(userTokenState, {
                            login: account?.login || undefined,
                        });
                        return res.redirect(userTokenUrl);
                    } catch (error) {
                        logger.warn(`[git-sync] auto user token auth failed: ${error.message}`);
                    }
                }
            }
        }

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

router.get('/github/app/user-token/callback', gitSyncRateLimit, async (req, res, next) => {
    try {
        const authCode = String(req.query.code || '').trim();
        const state = String(req.query.state || '').trim();
        const errorReason = String(req.query.error_description || req.query.error || '').trim();

        if (errorReason) {
            const redirectUrl = await resolveFrontendRedirect(null, '/app/account/oauth/bind/error', {
                message: errorReason,
            });
            if (redirectUrl) return res.redirect(redirectUrl);
            return res.status(400).send({ status: 'error', message: errorReason });
        }

        if (!authCode || !state) {
            const redirectUrl = await resolveFrontendRedirect(null, '/app/account/oauth/bind/error', {
                message: '缺少授权参数',
            });
            if (redirectUrl) return res.redirect(redirectUrl);
            return res.status(400).send({ status: 'error', message: '缺少授权参数' });
        }

        const stateKey = `git-sync:github:user-token:state:${state}`;
        const stateData = await redisClient.get(stateKey);
        await redisClient.delete(stateKey);

        if (!stateData?.userId) {
            const redirectUrl = await resolveFrontendRedirect(null, '/app/account/oauth/bind/error', {
                message: '授权状态已过期',
            });
            if (redirectUrl) return res.redirect(redirectUrl);
            return res.status(400).send({ status: 'error', message: '授权状态已过期' });
        }

        const tokenData = await exchangeUserToken(authCode);
        if (!tokenData?.access_token) {
            throw new Error('GitHub未返回有效的用户令牌');
        }

        const account = await getAuthenticatedUser(tokenData.access_token);
        const accountId = account?.id ? String(account.id) : '';
        const accountLogin = String(account?.login || '').trim();
        if (!accountId && !accountLogin) {
            throw new Error('无法获取GitHub账号信息');
        }

        if (stateData.linkId) {
            const link = await findUserGitLink(stateData.userId, stateData.linkId);
            if (!link) {
                throw new Error('目标账号不存在');
            }
            const linkAccountId = String(link?.account?.id || '').trim();
            const linkAccountLogin = String(link?.account?.login || '').trim().toLowerCase();
            const matches = (linkAccountId && linkAccountId === accountId)
                || (linkAccountLogin && accountLogin && linkAccountLogin === accountLogin.toLowerCase());
            if (!matches) {
                throw new Error('授权账号与目标账号不一致');
            }
        }

        await upsertUserGitHubUserToken(stateData.userId, {
            accountId,
            accountLogin,
            accessToken: tokenData.access_token,
            tokenType: tokenData.token_type || 'Bearer',
            scope: tokenData.scope || null,
            refreshToken: tokenData.refresh_token || null,
            expiresAt: buildExpiresAt(tokenData.expires_in),
        });

        const redirectUrl = await resolveFrontendRedirect(stateData.redirectUrl, '/app/account/oauth', {
            git_sync_user_token: 'success',
        });
        if (redirectUrl) return res.redirect(redirectUrl);
        res.status(200).send({ status: 'success' });
    } catch (error) {
        const redirectUrl = await resolveFrontendRedirect(null, '/app/account/oauth/bind/error', {
            message: `App User Token绑定失败: ${error.message}`,
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

router.get('/github/app/repos/check', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const linkId = String(req.query.linkId || '').trim();
        const repoName = sanitizeRepoNameInput(req.query.name);
        if (!linkId || !repoName) {
            return res.status(400).send({ status: 'error', message: '缺少仓库名称或账号' });
        }

        const link = await findUserGitLink(res.locals.userid, linkId);
        if (!link?.installationId) {
            return res.status(404).send({ status: 'error', message: '链接不存在' });
        }

        const accountLogin = normalizeRepoValue(link?.account?.login);
        if (!accountLogin) {
            return res.status(400).send({ status: 'error', message: '缺少账号信息' });
        }

        const accountType = normalizeAccountType(link?.account?.type);
        let token = null;

        if (accountType === 'organization') {
            const installationToken = (await createInstallationToken(link.installationId)).token;
            if (!installationToken) {
                return res.status(500).send({ status: 'error', message: '无法创建安装令牌' });
            }
            token = installationToken;
        } else {
            const userToken = await findUserGitHubUserToken(
                res.locals.userid,
                link?.account?.id,
                link?.account?.login
            );
            if (!userToken?.accessToken) {
                return res.status(400).send({
                    status: 'error',
                    code: 'user_token_required',
                    message: '个人仓库检查需要授权 App User Token',
                });
            }
            token = userToken.accessToken;
        }

        try {
            await getRepo(token, accountLogin, repoName);
            return res.status(200).send({ status: 'success', available: false });
        } catch (error) {
            if (error?.status === 404) {
                return res.status(200).send({ status: 'success', available: true });
            }
            throw error;
        }
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

router.post('/github/app/repos/create', needLogin, gitSyncRateLimit, async (req, res, next) => {
    try {
        const { linkId, name, description, private: isPrivate, autoInit } = req.body || {};
        const repoName = sanitizeRepoNameInput(name);
        if (!linkId || !repoName) {
            return res.status(400).send({ status: 'error', message: '缺少仓库名称或账号' });
        }

        const link = await findUserGitLink(res.locals.userid, linkId);
        if (!link?.installationId) {
            return res.status(404).send({ status: 'error', message: '链接不存在' });
        }

        const payload = {
            name: repoName,
        };

        const parsedPrivate = parseBooleanInput(isPrivate);
        if (parsedPrivate !== null) {
            payload.private = parsedPrivate;
        }

        const parsedAutoInit = parseBooleanInput(autoInit);
        if (parsedAutoInit !== null) {
            payload.auto_init = parsedAutoInit;
        }

        const normalizedDescription = sanitizeDescriptionInput(description);
        if (normalizedDescription) {
            payload.description = normalizedDescription;
        }

        const accountType = normalizeAccountType(link?.account?.type);
        const accountLogin = link?.account?.login || '';
        let repository = null;

        if (accountType === 'organization') {
            if (!accountLogin) {
                return res.status(400).send({ status: 'error', message: '缺少组织信息' });
            }
            const token = (await createInstallationToken(link.installationId)).token;
            if (!token) {
                return res.status(500).send({ status: 'error', message: '无法创建安装令牌' });
            }
            repository = await createOrgRepo(token, accountLogin, payload);
        } else {
            const userToken = await findUserGitHubUserToken(
                res.locals.userid,
                link?.account?.id,
                link?.account?.login
            );
            if (!userToken?.accessToken) {
                return res.status(400).send({
                    status: 'error',
                    code: 'user_token_required',
                    message: '个人仓库创建需要授权 App User Token',
                });
            }
            repository = await createUserRepo(userToken.accessToken, payload);
        }

        res.status(200).send({
            status: 'success',
            repository: {
                ...repository,
                gitLinkId: link.id,
                gitInstallationId: link.installationId,
                gitAccount: link.account || null,
            },
        });
    } catch (error) {
        logger.warn(`[git-sync] create repo failed: ${error.message}`);
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
            projectName: project.name || '',
            projectTitle: project.title || '',
            projectState: project.state || 'private',
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
