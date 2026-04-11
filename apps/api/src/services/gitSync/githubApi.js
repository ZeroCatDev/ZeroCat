import axios from 'axios';
import zcconfig from '../config/zcconfig.js';

const DEFAULT_API_BASE = 'https://api.github.com';

async function getApiBase() {
    const raw = await zcconfig.get('git.sync.github.api_base', DEFAULT_API_BASE);
    return String(raw || DEFAULT_API_BASE).replace(/\/+$/, '');
}

function buildHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}

async function request(token, method, path, data) {
    const baseURL = await getApiBase();
    try {
        const response = await axios({
            baseURL,
            url: path,
            method,
            data,
            headers: buildHeaders(token),
        });
        return response.data;
    } catch (error) {
        const status = error?.response?.status || 0;
        const message = error?.response?.data?.message || error.message || 'GitHub API error';
        const err = new Error(message);
        err.status = status;
        err.data = error?.response?.data || null;
        throw err;
    }
}

export async function getRepo(token, owner, repo) {
    return request(token, 'GET', `/repos/${owner}/${repo}`);
}

export async function listInstallationRepos(token, options = {}) {
    const perPage = Math.min(100, Math.max(1, Number(options.perPage) || 30));
    const page = Math.max(1, Number(options.page) || 1);
    const params = new URLSearchParams({
        per_page: String(perPage),
        page: String(page),
    });
    return request(token, 'GET', `/installation/repositories?${params.toString()}`);
}

export async function searchRepos(token, query, options = {}) {
    const safeQuery = String(query || '').trim();
    if (!safeQuery) {
        return { total_count: 0, items: [] };
    }

    const perPage = Math.min(100, Math.max(1, Number(options.perPage) || 20));
    const page = Math.max(1, Number(options.page) || 1);
    const params = new URLSearchParams({
        q: safeQuery,
        per_page: String(perPage),
        page: String(page),
    });

    return request(token, 'GET', `/search/repositories?${params.toString()}`);
}

export async function getRef(token, owner, repo, branch) {
    return request(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
}

export async function createRef(token, owner, repo, branch, sha) {
    return request(token, 'POST', `/repos/${owner}/${repo}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha,
    });
}

export async function updateRef(token, owner, repo, branch, sha) {
    return request(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        sha,
        force: true,
    });
}

export async function getCommit(token, owner, repo, sha) {
    return request(token, 'GET', `/repos/${owner}/${repo}/git/commits/${sha}`);
}

export async function getTree(token, owner, repo, treeSha, recursive = true) {
    const params = new URLSearchParams();
    if (recursive) params.set('recursive', '1');
    return request(token, 'GET', `/repos/${owner}/${repo}/git/trees/${treeSha}?${params.toString()}`);
}

export async function getContent(token, owner, repo, path, ref) {
    const params = new URLSearchParams();
    if (ref) params.set('ref', ref);
    return request(token, 'GET', `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?${params.toString()}`);
}

export async function createBlob(token, owner, repo, content, encoding = 'utf-8') {
    return request(token, 'POST', `/repos/${owner}/${repo}/git/blobs`, {
        content,
        encoding,
    });
}

export async function createTree(token, owner, repo, tree, baseTreeSha = null) {
    const payload = { tree };
    if (baseTreeSha) payload.base_tree = baseTreeSha;
    return request(token, 'POST', `/repos/${owner}/${repo}/git/trees`, payload);
}

export async function createCommit(token, owner, repo, message, treeSha, parents = []) {
    return request(token, 'POST', `/repos/${owner}/${repo}/git/commits`, {
        message,
        tree: treeSha,
        parents,
    });
}
