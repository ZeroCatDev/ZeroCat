import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import { prisma } from '../../prisma.js';
import { getSpaceConfig } from '../../commentService/spaceManager.js';
import notifyService from '../../commentService/notify/notifyService.js';
import logger from '../../logger.js';

let worker = null;

// ── Worker 主处理函数 ──

async function processNotification(job) {
    const { type, commentId, spaceCuid } = job.data;
    await job.log(`Processing ${type} for comment #${commentId} in ${spaceCuid}`);

    const comment = await prisma.ow_comment_service.findUnique({ where: { id: commentId } });
    if (!comment) {
        await job.log('Comment not found');
        return { skipped: true, reason: 'comment_not_found' };
    }

    // 被删除或标记为 spam 的评论不发通知
    if (comment.status === 'spam') {
        await job.log('Comment is spam, skip');
        return { skipped: true, reason: 'spam' };
    }

    const spaceConfig = await getSpaceConfig(spaceCuid);

    // 委托给 notifyService 处理所有通知逻辑
    return notifyService.run(type, comment, spaceConfig, spaceCuid, (msg) => job.log(msg));
}

async function createCommentNotificationWorker() {
    const connection = await createConnection('worker-comment-notification');

    worker = new Worker(
        QUEUE_NAMES.COMMENT_NOTIFICATION,
        processNotification,
        {
            connection,
            concurrency: 2,
            limiter: { max: 10, duration: 60000 },
        }
    );

    worker.on('completed', (job) => {
        logger.debug(`[comment-notify] Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        logger.error(`[comment-notify] Job ${job?.id} failed:`, err.message);
    });
    worker.on('error', (err) => {
        logger.error('[comment-notify] Worker error:', err.message);
    });

    logger.info('[comment-notify] Comment notification worker started');
    return worker;
}

function getCommentNotificationWorker() {
    return worker;
}

export { createCommentNotificationWorker, getCommentNotificationWorker };
