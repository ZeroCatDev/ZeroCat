import jwt from 'jsonwebtoken';
import axios from 'axios';
import zcconfig from '../config/zcconfig.js';

const DEFAULT_API_BASE = 'https://api.github.com';

async function getAppConfig() {
    const appId = String(await zcconfig.get('git.sync.github.app.id') || '').trim();
    const appSlug = String(await zcconfig.get('git.sync.github.app.slug') || '').trim();
    const apiBase = String(await zcconfig.get('git.sync.github.api_base', DEFAULT_API_BASE) || DEFAULT_API_BASE).replace(/\/+$/, '');
    const rawPrivateKey = String(await zcconfig.get('git.sync.github.app.private_key') || '').trim();
    return {
        appId,
        appSlug,
        apiBase,
        privateKey: normalizePrivateKey(rawPrivateKey),
    };
}

async function getUserTokenConfig() {
    const clientId = String(await zcconfig.get('git.sync.github.app.client_id') || '').trim();
    const clientSecret = String(await zcconfig.get('git.sync.github.app.client_secret') || '').trim();
    const scope = String(await zcconfig.get('git.sync.github.app.user_scope', 'repo read:user user:email') || '').trim();
    const backendUrl = String(await zcconfig.get('urls.backend') || '').trim().replace(/\/+$/, '');
    const redirectUri = backendUrl ? `${backendUrl}/git-sync/github/app/user-token/callback` : '';
    return {
        clientId,
        clientSecret,
        scope,
        redirectUri,
    };
}

function normalizePrivateKey(value) {
    if (!value) return '';
    let normalized = value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
    normalized = normalized.trim();

    if (!normalized.includes('BEGIN')) {
        const compact = normalized.replace(/\s+/g, '');
        if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 128) {
            try {
                const decoded = Buffer.from(compact, 'base64').toString('utf8');
                if (decoded.includes('BEGIN')) {
                    normalized = decoded;
                }
            } catch {
                return normalized;
            }
        }
    }

    if (normalized.includes('BEGIN') && !normalized.includes('\n')) {
        normalized = normalized.replace(/-----BEGIN[^-]+-----/, '$&\n');
        normalized = normalized.replace(/-----END[^-]+-----/, '\n$&');
        const match = normalized.match(/-----BEGIN[^-]+-----\n([\s\S]+)\n-----END/);
        if (match?.[1]) {
            const body = match[1].replace(/\s+/g, '');
            const wrapped = body.match(/.{1,64}/g)?.join('\n') || body;
            normalized = normalized.replace(match[1], wrapped);
        }
    }

    return normalized;
}

async function createAppJwt() {
    const { appId, privateKey } = await getAppConfig();
    if (!appId || !privateKey) {
        throw new Error('GitHub App credentials are not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    return jwt.sign({
        iat: now - 60,
        exp: now + 9 * 60,
        iss: appId,
    }, privateKey, { algorithm: 'RS256' });
}

async function requestAsApp(method, path, data) {
    const { apiBase } = await getAppConfig();
    const token = await createAppJwt();
    const response = await axios({
        baseURL: apiBase,
        url: path,
        method,
        data,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
        validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
        const message = response?.data?.message || `HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.data = response.data;
        throw error;
    }

    return response.data;
}

export async function buildInstallUrl(state) {
    const { appSlug } = await getAppConfig();
    if (!appSlug) {
        throw new Error('GitHub App slug is not configured');
    }
    const url = new URL(`https://github.com/apps/${appSlug}/installations/new`);
    if (state) url.searchParams.set('state', state);
    return url.toString();
}

export async function getInstallationInfo(installationId) {
    if (!installationId) throw new Error('Missing installation id');
    return requestAsApp('GET', `/app/installations/${installationId}`);
}

export async function createInstallationToken(installationId) {
    if (!installationId) throw new Error('Missing installation id');
    return requestAsApp('POST', `/app/installations/${installationId}/access_tokens`);
}

export async function buildUserTokenAuthUrl(state, options = {}) {
    const { clientId, scope, redirectUri } = await getUserTokenConfig();
    if (!clientId || !redirectUri) {
        throw new Error('GitHub App user token client is not configured');
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state: String(state || '').trim(),
    });

    const login = String(options?.login || '').trim();
    if (login) params.set('login', login);

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeUserToken(code) {
    const { clientId, clientSecret, redirectUri } = await getUserTokenConfig();
    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('GitHub App user token client is not configured');
    }

    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: String(code || '').trim(),
        redirect_uri: redirectUri,
    });

    const response = await axios.post('https://github.com/login/oauth/access_token', params.toString(), {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
        const message = response?.data?.error_description || response?.data?.error || `HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.data = response.data;
        throw error;
    }

    if (response?.data?.error) {
        const error = new Error(response.data.error_description || response.data.error);
        error.status = 400;
        error.data = response.data;
        throw error;
    }

    return response.data;
}
