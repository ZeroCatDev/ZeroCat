import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getEmailQueue, getScheduledTasksQueue } from './queues.js';
import logger from '../logger.js';

let serverAdapter = null;

function createDashboard() {
    const emailQueue = getEmailQueue();
    const scheduledTasksQueue = getScheduledTasksQueue();

    if (!emailQueue || !scheduledTasksQueue) {
        logger.warn('[bull-board] Queues not available, dashboard not created');
        return null;
    }

    serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
        queues: [
            new BullMQAdapter(emailQueue),
            new BullMQAdapter(scheduledTasksQueue),
        ],
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
