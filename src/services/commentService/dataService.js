import { prisma } from '../prisma.js';
import redisClient from '../redis.js';
import logger from '../logger.js';
import { getOrCreateSpaceUser } from './spaceManager.js';
import { sanitizeComment } from './sanitizer.js';
import { Parser } from '@json2csv/plainjs';

const TASK_TTL = 86400; // 24h
const DATA_TTL = 3600;  // 1h (导出数据)

// ============================================================
// 任务追踪 (Redis)
// ============================================================

/**
 * 创建任务记录
 */
export async function createTask(taskId, spaceId, userId, type, meta = {}) {
    const task = {
        id: taskId,
        space_id: spaceId,
        user_id: userId,
        type, // 'export' | 'import'
        status: 'pending',
        progress: 0,
        total: 0,
        processed: 0,
        created_at: new Date().toISOString(),
        completed_at: null,
        error: null,
        ...meta,
    };

    await redisClient.set(`cs:datatask:${taskId}`, task, TASK_TTL);

    // 追加到空间任务列表
    const listKey = `cs:datatask:space:${spaceId}`;
    let list = await redisClient.get(listKey);
    if (!Array.isArray(list)) list = [];
    list.unshift(taskId);
    if (list.length > 50) list.length = 50;
    await redisClient.set(listKey, list, TASK_TTL);

    return task;
}

/**
 * 更新任务状态
 */
export async function updateTask(taskId, updates) {
    const task = await redisClient.get(`cs:datatask:${taskId}`);
    if (!task) return null;

    Object.assign(task, updates);
    await redisClient.set(`cs:datatask:${taskId}`, task, TASK_TTL);
    return task;
}

/**
 * 获取任务
 */
export async function getTask(taskId) {
    return await redisClient.get(`cs:datatask:${taskId}`);
}

/**
 * 列出空间的数据任务
 */
export async function listTasks(spaceId) {
    const listKey = `cs:datatask:space:${spaceId}`;
    let taskIds = await redisClient.get(listKey);
    if (!Array.isArray(taskIds)) return [];

    const tasks = [];
    for (const id of taskIds) {
        const task = await getTask(id);
        if (task) tasks.push(task);
    }
    return tasks;
}

// ============================================================
// CSV 序列化 (Waline 标准格式, @json2csv/plainjs)
// ============================================================

const WALINE_FIELDS = [
    'id', 'nick', 'updatedAt', 'mail', 'ua', 'ip',
    'status', 'insertedAt', 'createdAt', 'comment',
    'pid', 'rid', 'link', 'url', 'user_id',
];

const csvParser = new Parser({
    fields: WALINE_FIELDS,
    defaultValue: '',
    header: true,
    eol: '\r\n',
});

/**
 * ISO 日期 → "YYYY-MM-DD HH:MM:SS" (Waline 标准格式)
 */
function formatDateForCsv(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/i, '');
}

// ============================================================
// 导出
// ============================================================

/**
 * 导出空间数据为 Waline 标准 CSV 格式
 */
export async function exportSpaceData(spaceId, spaceCuid, spaceName, taskId, progressCb) {
    const comments = await prisma.ow_comment_service.findMany({
        where: { space_id: spaceId },
        orderBy: { id: 'asc' },
    });

    const total = comments.length;
    if (progressCb) await progressCb(0, total);

    // 构建 DB id → 顺序 id 映射 (Waline CSV 使用从 1 开始的顺序编号)
    const idMap = {};
    comments.forEach((c, i) => {
        idMap[c.id] = i + 1;
    });

    const records = [];
    comments.forEach((c, i) => {
        if (progressCb && i > 0 && i % 100 === 0) progressCb(i, total);

        const pid = c.pid ? (idMap[Number(c.pid)] || null) : null;
        const rid = c.rid ? (idMap[Number(c.rid)] || null) : null;

        records.push({
            id: String(idMap[c.id]),
            nick: c.nick || '',
            updatedAt: formatDateForCsv(c.updatedAt),
            mail: c.mail || '',
            ua: c.ua || '',
            ip: c.ip || '',
            status: c.status || 'approved',
            insertedAt: formatDateForCsv(c.insertedAt),
            createdAt: formatDateForCsv(c.createdAt),
            comment: c.comment || '',
            pid: pid,
            rid: rid,
            link: c.link || '',
            url: c.url || '',
            user_id: c.user_id || '',
        });
    });

    const csv = csvParser.parse(records);

    if (progressCb) await progressCb(total, total);

    // CSV 字符串存入 Redis，1 小时有效
    await redisClient.set(`cs:datatask:data:${taskId}`, csv, DATA_TTL);

    return {
        commentCount: comments.length,
    };
}

/**
 * 获取导出数据 (CSV 字符串)
 */
export async function getExportData(taskId) {
    const data = await redisClient.get(`cs:datatask:data:${taskId}`);
    if (!data || typeof data !== 'string') return null;
    return data;
}

// ============================================================
// 导入
// ============================================================

// DB VarChar 字段长度限制
const COL_LIMITS = {
    user_id: 64,
    nick: 128,
    mail: 255,
    link: 255,
    url: 1024,
    ip: 100,
    status: 32,
    pid: 64,
    rid: 64,
};

const VALID_STATUS = new Set(['approved', 'waiting', 'spam']);

/**
 * 截断字符串到指定长度
 */
function truncate(val, max) {
    if (!val) return null;
    const str = String(val).trim();
    if (str.length === 0) return null;
    return str.length > max ? str.slice(0, max) : str;
}

/**
 * Waline CSV 日期 "YYYY-MM-DD HH:MM:SS" → Date 对象
 */
function parseCsvDate(val) {
    if (!val || typeof val !== 'string' || val.trim() === '') return new Date();
    const trimmed = val.trim();
    // "2025-01-01 12:00:00" → "2025-01-01T12:00:00.000Z"
    const iso = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T') + '.000Z';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * 将前端传入的 Waline CSV 对象数组预处理为可插入的格式
 *
 * CSV 字段:  id, nick, updatedAt, mail, ua, ip, status, insertedAt, createdAt, comment, pid, rid, link, url, user_id
 * DB 字段差异:
 *   - CSV id 是顺序编号 (1,2,3...)，不写入 DB，仅用于 pid/rid 映射
 *   - CSV pid/rid 引用 CSV id，需重映射到新 DB id
 *   - CSV user_id 是原系统用户 id，导入时通过邮箱重新关联
 *   - CSV 日期是 "YYYY-MM-DD HH:MM:SS" 字符串，需转 Date
 *   - CSV 空字段是 "" 空字符串，DB 期望 null
 *   - 各 VarChar 字段有长度限制
 */
function normalizeImportData(input) {
    if (!Array.isArray(input)) {
        throw new Error('请提供 Waline CSV 评论数组');
    }

    const comments = input.map((row, idx) => {
        const csvId = String(row.id || idx + 1);

        return {
            _csv_id: csvId,
            _csv_pid: row.pid && String(row.pid).trim() !== '' ? String(row.pid).trim() : null,
            _csv_rid: row.rid && String(row.rid).trim() !== '' ? String(row.rid).trim() : null,
            nick: truncate(row.nick, COL_LIMITS.nick) || 'Anonymous',
            mail: truncate(row.mail, COL_LIMITS.mail),
            link: truncate(row.link, COL_LIMITS.link),
            comment: row.comment || '',
            url: truncate(row.url, COL_LIMITS.url) || '/',
            ua: row.ua && String(row.ua).trim() !== '' ? String(row.ua).trim() : null,
            ip: truncate(row.ip, COL_LIMITS.ip),
            status: VALID_STATUS.has(row.status) ? row.status : 'approved',
            insertedAt: parseCsvDate(row.insertedAt),
            createdAt: parseCsvDate(row.createdAt),
            updatedAt: parseCsvDate(row.updatedAt),
        };
    });
    return comments;
}

/**
 * 导入评论到空间
 */
export async function importSpaceData(spaceId, inputData, taskId, progressCb) {
    const comments = normalizeImportData(inputData);

    const total = comments.length;
    let processed = 0;
    if (progressCb) await progressCb(0, total);

    // ── 阶段 1: 邮箱 → 用户映射 ──
    const emailToUser = new Map();
    const emails = [...new Set(
        comments.map(c => c.mail).filter(Boolean).map(e => e.toLowerCase())
    )];

    if (emails.length > 0) {
        const BATCH = 200;
        for (let i = 0; i < emails.length; i += BATCH) {
            const batch = emails.slice(i, i + BATCH);
            const users = await prisma.ow_users.findMany({
                where: { email: { in: batch } },
                select: { id: true, email: true, username: true, display_name: true, avatar: true },
            });
            for (const u of users) {
                emailToUser.set(u.email.toLowerCase(), u);
            }
        }
    }

    // ── 阶段 2: 插入评论 (CSV id → DB id 重映射) ──
    const csvIdToDbId = new Map(); // CSV 顺序 id → 新 DB id

    // 分离: 无 pid 为根评论，有 pid 为子评论
    const rootComments = comments.filter(c => !c._csv_pid);
    const childComments = comments.filter(c => c._csv_pid);

    // 先插入根评论
    for (const c of rootComments) {
        const record = await _createComment(spaceId, c, emailToUser, null, null);
        csvIdToDbId.set(c._csv_id, record.id);
        processed++;
        if (progressCb && processed % 50 === 0) await progressCb(processed, total);
    }

    // 多轮插入子评论 (处理嵌套)
    let remaining = [...childComments];
    let maxPasses = 20;

    while (remaining.length > 0 && maxPasses > 0) {
        const stillRemaining = [];

        for (const c of remaining) {
            const newPid = csvIdToDbId.get(c._csv_pid);
            if (newPid === undefined) {
                stillRemaining.push(c);
                continue;
            }

            const newRid = c._csv_rid ? (csvIdToDbId.get(c._csv_rid) ?? newPid) : newPid;

            const record = await _createComment(spaceId, c, emailToUser, newPid, newRid);
            csvIdToDbId.set(c._csv_id, record.id);
            processed++;
            if (progressCb && processed % 50 === 0) await progressCb(processed, total);
        }

        if (stillRemaining.length === remaining.length) {
            // 无法解析父级，降级为根评论
            for (const c of stillRemaining) {
                const record = await _createComment(spaceId, c, emailToUser, null, null);
                csvIdToDbId.set(c._csv_id, record.id);
                processed++;
            }
            break;
        }

        remaining = stillRemaining;
        maxPasses--;
    }

    if (progressCb) await progressCb(total, total);

    return {
        commentCount: comments.length,
        usersMapped: emailToUser.size,
    };
}

/**
 * 内部: 创建单条评论
 * @param {number} spaceId
 * @param {object} c - normalizeImportData 产出的评论对象
 * @param {Map} emailToUser - 邮箱 → ow_users 映射
 * @param {number|null} pid - 已映射的新 DB pid
 * @param {number|null} rid - 已映射的新 DB rid
 */
async function _createComment(spaceId, c, emailToUser, pid, rid) {
    let userId = null;

    // 通过邮箱关联 ZeroCat 用户
    if (c.mail) {
        const zcUser = emailToUser.get(c.mail.toLowerCase());
        if (zcUser) {
            userId = zcUser.id;
            try {
                await getOrCreateSpaceUser(spaceId, zcUser.id, {
                    display_name: zcUser.display_name || zcUser.username,
                    email: zcUser.email,
                    avatar: zcUser.avatar,
                });
            } catch (err) {
                logger.warn(`[data-import] getOrCreateSpaceUser failed uid=${zcUser.id}:`, err.message);
            }
        }
    }

    return prisma.ow_comment_service.create({
        data: {
            space_id: spaceId,
            user_id: userId ? truncate(String(userId), COL_LIMITS.user_id) : null,
            nick: c.nick,
            mail: c.mail,
            link: c.link,
            comment: sanitizeComment(c.comment),
            url: c.url,
            ua: c.ua,
            ip: c.ip,
            status: c.status,
            pid: pid != null ? truncate(String(pid), COL_LIMITS.pid) : null,
            rid: rid != null ? truncate(String(rid), COL_LIMITS.rid) : null,
            like: 0,
            sticky: false,
            insertedAt: c.insertedAt,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        },
    });
}

// ============================================================
// 站内信通知
// ============================================================

/**
 * 任务完成后发送站内信
 */
export async function notifyTaskComplete(userId, type, spaceName, result, error = null) {
    const isExport = type === 'export';

    const title = error
        ? `评论数据${isExport ? '导出' : '导入'}失败`
        : `评论数据${isExport ? '导出' : '导入'}完成`;

    let content;
    if (error) {
        content = `空间「${spaceName}」的数据${isExport ? '导出' : '导入'}任务失败: ${error}`;
    } else if (isExport) {
        content = `空间「${spaceName}」的数据导出已完成，共导出 ${result.commentCount} 条评论 (Waline CSV 格式)。请在 1 小时内下载导出文件。`;
    } else {
        content = `空间「${spaceName}」的数据导入已完成，共导入 ${result.commentCount} 条评论，关联 ${result.usersMapped} 位用户。`;
    }

    try {
        await prisma.ow_notifications.create({
            data: {
                user_id: userId,
                title,
                content,
                notification_type: 'comment_data_task',
                high_priority: false,
            },
        });
    } catch (err) {
        logger.error('[data-task] Failed to create notification:', err.message);
    }
}
