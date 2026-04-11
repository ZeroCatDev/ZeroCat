import { Router } from 'express';
import logger from '../services/logger.js';
import { needLogin } from '../middleware/auth.js';
import zcconfig from '../services/config/zcconfig.js';
import memoryCache from '../services/memoryCache.js';
import queueManager from '../services/queue/queueManager.js';
import {
    saveBlueskySyncTokensFromDid,
    getSocialIntegrationOverview,
    getTwitterSyncAppConfig,
    removeTwitterSyncAppConfig,
    saveTwitterSyncTokens,
    setTwitterSyncAppConfig,
    setUserBlueskyPds,
    setUserSocialSyncSettings,
} from '../services/social/socialSync.js';
import { OAUTH_PROVIDERS } from '../controllers/oauth.js';
import crypto from 'crypto';
import {
    consumeTwitterSyncCallback,
    createTwitterSyncAuthorizeUrl,
} from '../services/social/twitterSyncOAuth.js';
import {
    buildAtprotoSyncClientMetadata,
    consumeAtprotoSyncCallback,
    createAtprotoSyncAuthorizeUrl,
    getAtprotoSyncAppStateByCallbackState,
    saveUserAtprotoSyncDid,
} from '../services/social/atprotoSyncOAuth.js';
import { Agent } from '@atproto/api';

const router = Router();
const BLUESKY_SYNC_SCOPE = 'atproto repo:* blob:*/* transition:generic account:* identity:*';

router.get('/bluesky/sync/client-metadata.json', async (req, res) => {
    try {
        const metadata = await buildAtprotoSyncClientMetadata(BLUESKY_SYNC_SCOPE);

        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).json(metadata);
    } catch (error) {
        logger.error('[social] Build Bluesky sync client metadata failed:', error);
        res.status(500).json({ status: 'error', message: '生成Bluesky同步client metadata失败' });
    }
});

router.get('/overview', needLogin, async (req, res) => {
    try {
        const data = await getSocialIntegrationOverview(res.locals.userid);
        res.status(200).json({ status: 'success', data });
    } catch (error) {
        logger.error('[social] get overview failed:', error);
        res.status(500).json({ status: 'error', message: '获取社交集成信息失败' });
    }
});

router.post('/sync/settings', needLogin, async (req, res) => {
    try {
        const { twitter, bluesky } = req.body || {};
        if (twitter === undefined && bluesky === undefined) {
            return res.status(400).json({ status: 'error', message: '至少提供一个同步开关字段' });
        }

        const data = await setUserSocialSyncSettings(res.locals.userid, { twitter, bluesky });
        res.status(200).json({ status: 'success', data });
    } catch (error) {
        logger.error('[social] update sync settings failed:', error);
        res.status(400).json({ status: 'error', message: error.message || '更新同步设置失败' });
    }
});

router.get('/twitter/sync/app', needLogin, async (req, res) => {
    try {
        const data = await getTwitterSyncAppConfig(res.locals.userid, { masked: true });
        res.status(200).json({ status: 'success', data });
    } catch (error) {
        logger.error('[social] get twitter sync app config failed:', error);
        res.status(500).json({ status: 'error', message: '获取 Twitter 同步应用配置失败' });
    }
});

router.post('/twitter/sync/app', needLogin, async (req, res) => {
    try {
        const data = await setTwitterSyncAppConfig(res.locals.userid, req.body || {});
        res.status(200).json({ status: 'success', data });
    } catch (error) {
        logger.error('[social] set twitter sync app config failed:', error);
        res.status(400).json({ status: 'error', message: error.message || '设置 Twitter 同步应用配置失败' });
    }
});

router.delete('/twitter/sync/app', needLogin, async (req, res) => {
    try {
        await removeTwitterSyncAppConfig(res.locals.userid);
        res.status(200).json({ status: 'success', message: 'Twitter 同步应用配置已删除' });
    } catch (error) {
        logger.error('[social] remove twitter sync app config failed:', error);
        res.status(500).json({ status: 'error', message: '删除 Twitter 同步应用配置失败' });
    }
});

router.get('/twitter/sync/oauth/start', needLogin, async (req, res) => {
    try {
        const appConfig = await getTwitterSyncAppConfig(res.locals.userid, { masked: false });
        if (!appConfig?.clientId || !appConfig?.clientSecret || !appConfig?.redirectUri) {
            return res.status(400).json({ status: 'error', message: '请先设置 Twitter 同步 OAuth App 配置' });
        }

        const state = crypto.randomBytes(16).toString('hex');
        const { authUrl } = createTwitterSyncAuthorizeUrl({
            appConfig,
            userId: res.locals.userid,
            state,
        });

        return res.redirect(authUrl);
    } catch (error) {
        logger.error('[social] start twitter sync oauth failed:', error);
        return res.status(500).json({ status: 'error', message: '启动 Twitter 同步授权失败' });
    }
});

router.get('/twitter/sync/oauth/callback', async (req, res) => {
    const frontend = await zcconfig.get('urls.frontend');
    const redirect = (ok, message = '') => {
        const suffix = ok
            ? `/app/account/social/sync/twitter/success${message ? `?message=${encodeURIComponent(message)}` : ''}`
            : `/app/account/social/sync/twitter/error${message ? `?message=${encodeURIComponent(message)}` : ''}`;
        return res.redirect(`${frontend}${suffix}`);
    };

    try {
        const { code, state } = req.query || {};
        if (!code || !state) {
            return redirect(false, '缺少 code 或 state');
        }

        const callbackResult = await consumeTwitterSyncCallback({
            state: String(state),
            code: String(code),
        });

        await saveTwitterSyncTokens(callbackResult.userId, {
            ...callbackResult.tokens,
            provider_user_id: callbackResult.profile?.id || null,
            provider_username: callbackResult.profile?.username || null,
            provider_name: callbackResult.profile?.name || null,
            provider_avatar: callbackResult.profile?.avatar || null,
        });
        return redirect(true);
    } catch (error) {
        logger.error('[social] twitter sync oauth callback failed:', error);
        return redirect(false, error.message || 'Twitter 同步授权失败');
    }
});

router.post('/bluesky/pds', needLogin, async (req, res) => {
    try {
        const { pds } = req.body || {};
        if (!pds) {
            return res.status(400).json({ status: 'error', message: 'pds 不能为空' });
        }

        const data = await setUserBlueskyPds(res.locals.userid, pds);
        return res.status(200).json({ status: 'success', data: { pds: data } });
    } catch (error) {
        logger.error('[social] set bluesky pds failed:', error);
        return res.status(400).json({ status: 'error', message: error.message || '设置 Bluesky PDS 失败' });
    }
});

router.get('/bluesky/sync/oauth/start', needLogin, async (req, res) => {
    try {
        const provider = 'bluesky';
        if (!OAUTH_PROVIDERS[provider]?.enabled) {
            return res.status(400).json({ status: 'error', message: 'Bluesky OAuth 未启用' });
        }

        const identifier = String(req.query?.identifier || req.query?.account || req.query?.domain || req.query?.pds || '').trim();
        const scope = BLUESKY_SYNC_SCOPE;

        const state = crypto.randomBytes(16).toString('hex');

        const authUrl = await createAtprotoSyncAuthorizeUrl({
            loginHint: identifier,
            state,
            scope,
        });

        memoryCache.set(`bluesky_sync_state:${state}`, {
            userId: res.locals.userid,
            identifier,
            scope,
        }, 600);

        return res.redirect(authUrl);
    } catch (error) {
        logger.error('[social] start bluesky sync oauth failed:', error);
        return res.status(500).json({ status: 'error', message: '启动 Bluesky 同步授权失败: ' + error.message });
    }
});

router.get('/bluesky/sync/oauth/callback', async (req, res) => {
    const frontend = await zcconfig.get('urls.frontend');
    const redirect = (ok, message = '') => {
        const suffix = ok
            ? `/app/account/social/sync/bluesky/success${message ? `?message=${encodeURIComponent(message)}` : ''}`
            : `/app/account/social/sync/bluesky/error${message ? `?message=${encodeURIComponent(message)}` : ''}`;
        return res.redirect(`${frontend}${suffix}`);
    };

    try {
        const { code, state, error, error_description: errorDescription } = req.query || {};
        if (!state) {
            return redirect(false, '缺少 state');
        }

        if (error) {
            return redirect(false, String(errorDescription || error || 'OAuth授权失败'));
        }

        if (!code) {
            return redirect(false, '缺少 code');
        }

        const appState = await getAtprotoSyncAppStateByCallbackState(state);
        const syncStateKey = appState || String(state);
        const syncState = memoryCache.get(`bluesky_sync_state:${syncStateKey}`);
        if (!syncState?.userId) {
            logger.warn(`[social] bluesky sync callback state missed: callbackState=${state}, appState=${appState || ''}`);
            return redirect(false, '授权状态已失效');
        }

        memoryCache.delete(`bluesky_sync_state:${syncStateKey}`);

        const { session } = await consumeAtprotoSyncCallback({
            callbackQuery: req.query,
            scope: syncState.scope || BLUESKY_SYNC_SCOPE,
        });

        const did = String(session?.did || '').trim();
        if (!did) {
            return redirect(false, 'Bluesky同步授权未返回有效DID');
        }

        let profile = null;
        try {
            const agent = new Agent(session);
            const profileResp = await agent.getProfile({ actor: did });
            profile = profileResp?.data || null;
        } catch {
            profile = null;
        }

        await saveUserAtprotoSyncDid(syncState.userId, did);
        await saveBlueskySyncTokensFromDid(syncState.userId, {
            did,
            scope: syncState.scope || BLUESKY_SYNC_SCOPE,
            handle: profile?.handle || null,
        });

        return redirect(true);
    } catch (error) {
        logger.error('[social] bluesky sync oauth callback failed:', error);
        return redirect(false, error.message || 'Bluesky同步授权失败');
    }
});

router.post('/sync/post/:postId', needLogin, async (req, res) => {
    try {
        const postId = Number(req.params.postId);
        if (!Number.isInteger(postId) || postId <= 0) {
            return res.status(400).json({ status: 'error', message: 'postId 非法' });
        }

        const result = await queueManager.enqueueSocialPostSync(res.locals.userid, postId, 'manual');
        if (!result) {
            return res.status(500).json({ status: 'error', message: '同步任务入队失败' });
        }

        return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        logger.error('[social] enqueue sync post failed:', error);
        return res.status(500).json({ status: 'error', message: '同步任务入队失败' });
    }
});

export default router;
