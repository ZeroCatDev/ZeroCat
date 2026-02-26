import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getEmailQueue, getScheduledTasksQueue, getCommentNotificationQueue, getDataTaskQueue, getSocialSyncQueue } from './queues.js';
import logger from '../logger.js';

let serverAdapter = null;

function createDashboard() {
    const emailQueue = getEmailQueue();
    const scheduledTasksQueue = getScheduledTasksQueue();
    const commentNotificationQueue = getCommentNotificationQueue();
    const dataTaskQueue = getDataTaskQueue();
    const socialSyncQueue = getSocialSyncQueue();

    if (!emailQueue || !scheduledTasksQueue) {
        logger.warn('[bull-board] Queues not available, dashboard not created');
        return null;
    }

    serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    const queues = [
        new BullMQAdapter(emailQueue),
        new BullMQAdapter(scheduledTasksQueue),
    ];
    if (commentNotificationQueue) queues.push(new BullMQAdapter(commentNotificationQueue));
    if (dataTaskQueue) queues.push(new BullMQAdapter(dataTaskQueue));
    if (socialSyncQueue) queues.push(new BullMQAdapter(socialSyncQueue));

    createBullBoard({
        queues,
        serverAdapter,
    });

    logger.info('[bull-board] Dashboard created at /admin/queues');
    return serverAdapter;
}

function getDashboardRouter() {
    if (!serverAdapter) {
        createDashboard();
    }
    return serverAdapter?.getRouter() || null;
}

export { createDashboard, getDashboardRouter };
