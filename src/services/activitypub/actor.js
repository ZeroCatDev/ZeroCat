/**
 * ActivityPub Actor 构建
 * 将本地用户映射为 ActivityPub Actor 对象
 */

import { prisma } from '../prisma.js';
import logger from '../logger.js';
import { AP_CONTEXT, getApEndpointBaseUrl, getInstanceBaseUrl, getStaticUrl } from './config.js';
import { getUserPublicKey } from './keys.js';

/**
 * 根据用户名获取本地用户
 */
export async function getLocalUserByUsername(username) {
    return prisma.ow_users.findFirst({
        where: { username, status: 'active' },
        select: {
            id: true,
            username: true,
            display_name: true,
            bio: true,
            motto: true,
            avatar: true,
            images: true,
            url: true,
            location: true,
            sex: true,
            birthday: true,
            regTime: true,
            updatedAt: true,
        },
    });
}

/**
 * 根据 ID 获取本地用户
 */
export async function getLocalUserById(userId) {
    return prisma.ow_users.findFirst({
        where: { id: userId, status: 'active' },
        select: {
            id: true,
            username: true,
            display_name: true,
            bio: true,
            motto: true,
            avatar: true,
            images: true,
            url: true,
            location: true,
            sex: true,
            birthday: true,
            regTime: true,
            updatedAt: true,
        },
    });
}

/**
 * 构建用户头像 URL
 */
async function buildAvatarUrl(user) {
    const staticUrl = await getStaticUrl();
    if (user.avatar) {
        // 头像可能是完整 URL 或哈希
        if (user.avatar.startsWith('http')) return user.avatar;
        const p1 = user.avatar.substring(0, 2);
        const p2 = user.avatar.substring(2, 4);
        return `${staticUrl}/assets/${p1}/${p2}/${user.avatar}.webp`;
    }
    return null;
}

/**
 * 构建用户背景图 URL
 */
async function buildBannerUrl(user) {
    const staticUrl = await getStaticUrl();
    if (user.images) {
        if (user.images.startsWith('http')) return user.images;
        const p1 = user.images.substring(0, 2);
        const p2 = user.images.substring(2, 4);
        return `${staticUrl}/assets/${p1}/${p2}/${user.images}.webp`;
    }
    return null;
}

/**
 * 构建 ActivityPub Actor 对象
 * @param {object} user 本地用户记录
 * @returns {object} AP Actor (Person)
 */
export async function buildActorObject(user) {
    const apBaseUrl = await getApEndpointBaseUrl();
    const frontendBaseUrl = await getInstanceBaseUrl();
    const actorUrl = `${apBaseUrl}/ap/users/${user.username}`;
    const publicKey = await getUserPublicKey(user.id);
    const avatarUrl = await buildAvatarUrl(user);
    const bannerUrl = await buildBannerUrl(user);

    // 构建 attachment（Mastodon 个人资料元数据字段）
    const attachment = [];
    attachment.push({
        type: 'PropertyValue',
        name: '个人主页',
        value: `<a href="${frontendBaseUrl}/${user.username}" rel="me nofollow noopener noreferrer" target="_blank">${frontendBaseUrl}/${user.username}</a>`,
    });
    if (user.url) {
        attachment.push({
            type: 'PropertyValue',
            name: '网站',
            value: `<a href="${user.url}" rel="me nofollow noopener noreferrer" target="_blank">${user.url}</a>`,
        });
    }
    if (user.location) {
        attachment.push({
            type: 'PropertyValue',
            name: '位置',
            value: user.location,
        });
    }
    if (user.bio) {
        attachment.push({
            type: 'PropertyValue',
            name: '简介',
            value: user.bio,
        });
    }
    if (user.birthday) {
        const bd = new Date(user.birthday);
        const bdStr = `${bd.getMonth() + 1}月${bd.getDate()}日`;
        attachment.push({
            type: 'PropertyValue',
            name: '生日',
            value: bdStr,
        });
    }

    const actor = {
        '@context': AP_CONTEXT,
        id: actorUrl,
        type: 'Person',
        preferredUsername: user.username,
        name: user.display_name || user.username,
        summary: user.motto || '',
        url: `${frontendBaseUrl}/${user.username}`,
        inbox: `${actorUrl}/inbox`,
        outbox: `${actorUrl}/outbox`,
        followers: `${actorUrl}/followers`,
        following: `${actorUrl}/following`,
        published: user.regTime ? new Date(user.regTime).toISOString() : undefined,
        updated: user.updatedAt ? new Date(user.updatedAt).toISOString() : undefined,
        manuallyApprovesFollowers: false,
        discoverable: true,
        indexable: true,
        memorial: false,
        attachment,
        tag: [],
        publicKey: {
            id: `${actorUrl}#main-key`,
            owner: actorUrl,
            publicKeyPem: publicKey,
        },
        endpoints: {
            sharedInbox: `${apBaseUrl}/ap/inbox`,
        },
    };

    if (avatarUrl) {
        actor.icon = {
            type: 'Image',
            mediaType: 'image/webp',
            url: avatarUrl,
        };
    }

    if (bannerUrl) {
        actor.image = {
            type: 'Image',
            mediaType: 'image/webp',
            url: bannerUrl,
        };
    }

    return actor;
}

/**
 * 获取 Actor URL
 */
export async function getActorUrl(username) {
    const apBaseUrl = await getApEndpointBaseUrl();
    return `${apBaseUrl}/ap/users/${username}`;
}

/**
 * 获取 Actor 的 key ID
 */
export async function getActorKeyId(username) {
    const actorUrl = await getActorUrl(username);
    return `${actorUrl}#main-key`;
}
