import { prisma } from '../prisma.js';
import logger from '../logger.js';
import { randomUUID } from 'crypto';

const USER_TARGET_TYPE = 'user';
const PROJECT_TARGET_TYPE = 'project';

const USER_LINKS_KEY = 'git.links';
const PROJECT_SETTINGS_KEY = 'git.sync.settings';
const PROJECT_STATE_KEY = 'git.sync.state';

const parseJsonValue = (raw, fallback) => {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch (error) {
        logger.warn(`[git-sync] Failed to parse target config JSON: ${error.message}`);
        return fallback;
    }
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

async function readTargetConfig({ targetType, targetId, key }) {
    const record = await prisma.ow_target_configs.findUnique({
        where: {
            target_type_target_id_key: {
                target_type: targetType,
                target_id: String(targetId),
                key,
            },
        },
        select: { value: true },
    });
    return record?.value ?? null;
}

async function writeTargetConfig({ targetType, targetId, key, value }) {
    await prisma.ow_target_configs.upsert({
        where: {
            target_type_target_id_key: {
                target_type: targetType,
                target_id: String(targetId),
                key,
            },
        },
        update: { value },
        create: {
            target_type: targetType,
            target_id: String(targetId),
            key,
            value,
        },
    });
}

export async function getUserGitLinks(userId) {
    if (!userId) return [];
    const raw = await readTargetConfig({
        targetType: USER_TARGET_TYPE,
        targetId: userId,
        key: USER_LINKS_KEY,
    });
    return normalizeArray(parseJsonValue(raw, []));
}

export async function findUserGitLink(userId, linkId) {
    const links = await getUserGitLinks(userId);
    return links.find((link) => link?.id === linkId) || null;
}

export async function addUserGitLink(userId, link) {
    if (!userId || !link) return null;

    const links = await getUserGitLinks(userId);
    const now = new Date().toISOString();
    const normalized = {
        id: link.id || randomUUID(),
        provider: link.provider || 'github',
        kind: link.kind || 'app',
        installationId: link.installationId || null,
        account: link.account || null,
        meta: link.meta || null,
        createdAt: link.createdAt || now,
        updatedAt: now,
    };

    const existingIndex = links.findIndex((item) => (
        item?.provider === normalized.provider
        && item?.kind === normalized.kind
        && String(item?.installationId || '') === String(normalized.installationId || '')
    ));

    if (existingIndex >= 0) {
        links[existingIndex] = {
            ...links[existingIndex],
            ...normalized,
            id: links[existingIndex].id || normalized.id,
            createdAt: links[existingIndex].createdAt || normalized.createdAt,
            updatedAt: now,
        };
    } else {
        links.push(normalized);
    }

    await writeTargetConfig({
        targetType: USER_TARGET_TYPE,
        targetId: userId,
        key: USER_LINKS_KEY,
        value: JSON.stringify(links),
    });

    return normalized;
}

export async function removeUserGitLink(userId, linkId) {
    if (!userId || !linkId) return null;
    const links = await getUserGitLinks(userId);
    const remaining = links.filter((link) => link?.id !== linkId);
    if (remaining.length === links.length) return null;

    await writeTargetConfig({
        targetType: USER_TARGET_TYPE,
        targetId: userId,
        key: USER_LINKS_KEY,
        value: JSON.stringify(remaining),
    });

    return true;
}

export async function getProjectGitSyncSettings(projectId) {
    if (!projectId) return null;
    const raw = await readTargetConfig({
        targetType: PROJECT_TARGET_TYPE,
        targetId: projectId,
        key: PROJECT_SETTINGS_KEY,
    });
    return parseJsonValue(raw, null);
}

export async function setProjectGitSyncSettings(projectId, settings) {
    if (!projectId) return null;
    await writeTargetConfig({
        targetType: PROJECT_TARGET_TYPE,
        targetId: projectId,
        key: PROJECT_SETTINGS_KEY,
        value: JSON.stringify(settings || {}),
    });
    return settings;
}

export async function updateProjectGitSyncSettings(projectId, partial) {
    if (!projectId) return null;
    const current = await getProjectGitSyncSettings(projectId);
    const merged = {
        ...(current || {}),
        ...(partial || {}),
        updatedAt: new Date().toISOString(),
    };

    await setProjectGitSyncSettings(projectId, merged);
    return merged;
}

export async function getProjectGitSyncState(projectId) {
    if (!projectId) return null;
    const raw = await readTargetConfig({
        targetType: PROJECT_TARGET_TYPE,
        targetId: projectId,
        key: PROJECT_STATE_KEY,
    });
    return parseJsonValue(raw, null);
}

export async function setProjectGitSyncState(projectId, state) {
    if (!projectId) return null;
    await writeTargetConfig({
        targetType: PROJECT_TARGET_TYPE,
        targetId: projectId,
        key: PROJECT_STATE_KEY,
        value: JSON.stringify(state || {}),
    });
    return state;
}

export const GIT_SYNC_KEYS = {
    USER_LINKS_KEY,
    PROJECT_SETTINGS_KEY,
    PROJECT_STATE_KEY,
};
