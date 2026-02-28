/**
 * ActivityPub 数据存储层
 * 使用 ow_cache_kv 和 ow_target_configs 表存储 AP 运行时数据
 * 全局配置项由 zcconfig (ow_config) 管理，此处不涉及
 * 不修改数据库结构，完全利用现有表的灵活性
 */

import { prisma } from '../prisma.js';
import logger from '../logger.js';
import { TARGET_TYPES, CACHE_KV_KEYS } from './config.js';

// ─── ow_target_configs helpers ────────────────────────────────

function getTargetConfigModel() {
    return prisma.ow_target_configs || prisma.c;
}

/**
 * 读取 target_config 记录
 */
export async function getTargetConfig(targetType, targetId, key) {
    try {
        const model = getTargetConfigModel();
        const record = await model.findUnique({
            where: {
                target_type_target_id_key: {
                    target_type: targetType,
                    target_id: String(targetId),
                    key,
                },
            },
        });
        return record?.value ?? null;
    } catch (err) {
        logger.error('[ap-store] getTargetConfig error:', err.message);
        return null;
    }
}

/**
 * 写入/更新 target_config 记录
 */
export async function upsertTargetConfig(targetType, targetId, key, value) {
    const finalValue = typeof value === 'string' ? value : JSON.stringify(value);
    const model = getTargetConfigModel();
    await model.upsert({
        where: {
            target_type_target_id_key: {
                target_type: targetType,
                target_id: String(targetId),
                key,
            },
        },
        update: { value: finalValue },
        create: {
            target_type: targetType,
            target_id: String(targetId),
            key,
            value: finalValue,
        },
    });
}

/**
 * 删除 target_config 记录
 */
export async function deleteTargetConfig(targetType, targetId, key) {
    const model = getTargetConfigModel();
    await model.deleteMany({
        where: {
            target_type: targetType,
            target_id: String(targetId),
            key,
        },
    });
}

/**
 * 按前缀查询 target_config 记录
 */
export async function queryTargetConfigs(targetType, targetId, keyPrefix, limit = 100, offset = 0) {
    const model = getTargetConfigModel();
    return model.findMany({
        where: {
            target_type: targetType,
            target_id: String(targetId),
            key: { startsWith: keyPrefix },
        },
        take: limit,
        skip: offset,
        orderBy: { id: 'desc' },
    });
}

/**
 * 统计 target_config 记录数
 */
export async function countTargetConfigs(targetType, targetId, keyPrefix) {
    const model = getTargetConfigModel();
    return model.count({
        where: {
            target_type: targetType,
            target_id: String(targetId),
            key: { startsWith: keyPrefix },
        },
    });
}

// ─── ow_cache_kv helpers ──────────────────────────────────────

/**
 * 读取用户级 KV 缓存
 */
export async function getUserKv(userId, key) {
    try {
        const record = await prisma.ow_cache_kv.findUnique({
            where: { user_id_key: { user_id: userId, key } },
        });
        return record?.value ?? null;
    } catch (err) {
        logger.error('[ap-store] getUserKv error:', err.message);
        return null;
    }
}

/**
 * 写入用户级 KV 缓存
 */
export async function setUserKv(userId, key, value, ip = '') {
    await prisma.ow_cache_kv.upsert({
        where: { user_id_key: { user_id: userId, key } },
        update: { value, updated_at: new Date() },
        create: { user_id: userId, key, value, creator_ip: ip },
    });
}

/**
 * 删除用户级 KV 缓存
 */
export async function deleteUserKv(userId, key) {
    await prisma.ow_cache_kv.deleteMany({
        where: { user_id: userId, key },
    });
}

// ─── AP 用户配置 (target_type = 'ap_user', target_id = userId) ───

export async function getApUserConfig(userId, key) {
    return getTargetConfig(TARGET_TYPES.AP_USER, String(userId), key);
}

export async function setApUserConfig(userId, key, value) {
    return upsertTargetConfig(TARGET_TYPES.AP_USER, String(userId), key, value);
}

// ─── 远程 Actor 缓存 ─────────────────────────────────────────

/**
 * 缓存远程 Actor 数据
 */
export async function cacheRemoteActor(actorUrl, actorData) {
    const key = `actor:${actorUrl}`;
    await upsertTargetConfig(TARGET_TYPES.AP_REMOTE_ACTOR, '0', key, actorData);
}

/**
 * 获取缓存的远程 Actor
 */
export async function getCachedRemoteActor(actorUrl) {
    const key = `actor:${actorUrl}`;
    const raw = await getTargetConfig(TARGET_TYPES.AP_REMOTE_ACTOR, '0', key);
    if (!raw) return null;
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        return null;
    }
}

// ─── 远程关注者列表 ──────────────────────────────────────────

/**
 * 添加远程关注者
 */
export async function addRemoteFollower(userId, followerActorUrl, followerInbox) {
    const key = `follower:${followerActorUrl}`;
    await upsertTargetConfig(TARGET_TYPES.AP_FOLLOW, String(userId), key, JSON.stringify({
        actorUrl: followerActorUrl,
        inbox: followerInbox,
        followedAt: new Date().toISOString(),
    }));
}

/**
 * 移除远程关注者
 */
export async function removeRemoteFollower(userId, followerActorUrl) {
    const key = `follower:${followerActorUrl}`;
    await deleteTargetConfig(TARGET_TYPES.AP_FOLLOW, String(userId), key);
}

/**
 * 获取用户的所有远程关注者
 */
export async function getRemoteFollowers(userId, limit = 200, offset = 0) {
    const records = await queryTargetConfigs(
        TARGET_TYPES.AP_FOLLOW,
        String(userId),
        'follower:',
        limit,
        offset,
    );
    return records.map(r => {
        try {
            return JSON.parse(r.value);
        } catch {
            return { actorUrl: r.key.replace('follower:', ''), inbox: null };
        }
    }).filter(f => f.inbox);
}

/**
 * 统计远程关注者数量
 */
export async function countRemoteFollowers(userId) {
    return countTargetConfigs(TARGET_TYPES.AP_FOLLOW, String(userId), 'follower:');
}

/**
 * 检查某远程 Actor 是否关注了该用户
 */
export async function isRemoteFollower(userId, followerActorUrl) {
    const key = `follower:${followerActorUrl}`;
    const val = await getTargetConfig(TARGET_TYPES.AP_FOLLOW, String(userId), key);
    return val !== null;
}

// ─── 活动记录 ────────────────────────────────────────────────

/**
 * 存储活动记录（用于去重和撤销）
 */
export async function storeActivity(activityId, data) {
    const key = `act:${activityId}`;
    await upsertTargetConfig(TARGET_TYPES.AP_ACTIVITY, '0', key, data);
}

/**
 * 获取活动记录
 */
export async function getActivity(activityId) {
    const key = `act:${activityId}`;
    const raw = await getTargetConfig(TARGET_TYPES.AP_ACTIVITY, '0', key);
    if (!raw) return null;
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        return null;
    }
}

/**
 * 删除活动记录
 */
export async function deleteActivity(activityId) {
    const key = `act:${activityId}`;
    await deleteTargetConfig(TARGET_TYPES.AP_ACTIVITY, '0', key);
}

// ─── 帖子 AP 引用管理 ────────────────────────────────────────

/**
 * 在帖子的 platform_refs 中存储 AP 引用
 */
export async function setPostApRef(postId, apId, apUrl) {
    const post = await prisma.ow_posts.findUnique({
        where: { id: postId },
        select: { platform_refs: true },
    });
    const refs = (post?.platform_refs && typeof post.platform_refs === 'object')
        ? { ...post.platform_refs }
        : {};
    refs.activitypub = { id: apId, url: apUrl };
    await prisma.ow_posts.update({
        where: { id: postId },
        data: { platform_refs: refs },
    });
}

/**
 * 获取帖子的 AP ID
 */
export async function getPostApId(postId) {
    const post = await prisma.ow_posts.findUnique({
        where: { id: postId },
        select: { platform_refs: true },
    });
    return post?.platform_refs?.activitypub?.id || null;
}
