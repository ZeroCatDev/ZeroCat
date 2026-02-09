import { prisma } from './prisma.js';
import logger from './logger.js';

const TARGET_TYPE = 'extension';
const REVIEW_KEY = 'review.status';
const AUTO_APPROVE_USER_ID = 1;
const AUTO_APPROVE_KEY = 'extensions.auto_approve_users';

async function getReviewStatus(projectId) {
    const config = await prisma.ow_target_configs.findUnique({
        where: {
            target_type_target_id_key: {
                target_type: TARGET_TYPE,
                target_id: String(projectId),
                key: REVIEW_KEY,
            },
        },
    });
    return config ? config.value : null;
}

async function setReviewStatus(projectId, status, note) {
    const value = note ? JSON.stringify({ status, note }) : status;
    await prisma.ow_target_configs.upsert({
        where: {
            target_type_target_id_key: {
                target_type: TARGET_TYPE,
                target_id: String(projectId),
                key: REVIEW_KEY,
            },
        },
        update: { value },
        create: {
            target_type: TARGET_TYPE,
            target_id: String(projectId),
            key: REVIEW_KEY,
            value,
        },
    });
}

async function getAllApprovedProjectIds() {
    const configs = await prisma.ow_target_configs.findMany({
        where: {
            target_type: TARGET_TYPE,
            key: REVIEW_KEY,
            value: 'approved',
        },
    });
    return configs.map((c) => Number(c.target_id));
}

async function isAutoApproveUser(username) {
    const users = await getAutoApproveUsers();
    return users.includes(username);
}

async function getAutoApproveUsers() {
    try {
        const record = await prisma.ow_cache_kv.findUnique({
            where: {
                user_id_key: {
                    user_id: AUTO_APPROVE_USER_ID,
                    key: AUTO_APPROVE_KEY,
                },
            },
        });
        if (!record || !record.value) return [];
        const val = record.value;
        return Array.isArray(val) ? val : [];
    } catch (err) {
        logger.error('Error reading auto-approve users:', err);
        return [];
    }
}

async function setAutoApproveUsers(usernames) {
    await prisma.ow_cache_kv.upsert({
        where: {
            user_id_key: {
                user_id: AUTO_APPROVE_USER_ID,
                key: AUTO_APPROVE_KEY,
            },
        },
        update: { value: usernames },
        create: {
            user_id: AUTO_APPROVE_USER_ID,
            key: AUTO_APPROVE_KEY,
            value: usernames,
        },
    });
}

export {
    getReviewStatus,
    setReviewStatus,
    getAllApprovedProjectIds,
    isAutoApproveUser,
    getAutoApproveUsers,
    setAutoApproveUsers,
};
