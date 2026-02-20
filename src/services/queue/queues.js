import { Queue } from 'bullmq';
import { createConnection } from './redisConnectionFactory.js';
import logger from '../logger.js';

export const QUEUE_NAMES = {
    EMAIL: 'email',
    SCHEDULED_TASKS: 'scheduled-tasks',
    COMMENT_NOTIFICATION: 'comment-notification',
};

const QUEUE_OPTIONS = {
    [QUEUE_NAMES.EMAIL]: {
        defaultJobOptions: {
            removeOnComplete: { count: 200 },
            removeOnFail: { count: 500 },
        },
    },
    [QUEUE_NAMES.SCHEDULED_TASKS]: {
        defaultJobOptions: {
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 200 },
        },
    },
    [QUEUE_NAMES.COMMENT_NOTIFICATION]: {
        defaultJobOptions: {
            removeOnComplete: { count: 200 },
            removeOnFail: { count: 500 },
        },
    },
};

let emailQueue = null;
let scheduledTasksQueue = null;
let commentNotificationQueue = null;

async function createQueues() {
    const connection = await createConnection('queue-shared');

    emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
        connection,
        ...QUEUE_OPTIONS[QUEUE_NAMES.EMAIL],
    });

    scheduledTasksQueue = new Queue(QUEUE_NAMES.SCHEDULED_TASKS, {
        connection,
        ...QUEUE_OPTIONS[QUEUE_NAMES.SCHEDULED_TASKS],
    });

    commentNotificationQueue = new Queue(QUEUE_NAMES.COMMENT_NOTIFICATION, {
        connection,
        ...QUEUE_OPTIONS[QUEUE_NAMES.COMMENT_NOTIFICATION],
    });

    logger.info('[queues] All queues created');
    return { emailQueue, scheduledTasksQueue, commentNotificationQueue };
}

function getEmailQueue() {
    return emailQueue;
}

function getScheduledTasksQueue() {
    return scheduledTasksQueue;
}

function getCommentNotificationQueue() {
    return commentNotificationQueue;
}

export { createQueues, getEmailQueue, getScheduledTasksQueue, getCommentNotificationQueue };
