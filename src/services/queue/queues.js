import { Queue } from 'bullmq';
import { createConnection } from './redisConnectionFactory.js';
import logger from '../logger.js';

export const QUEUE_NAMES = {
    EMAIL: 'email',
    SCHEDULED_TASKS: 'scheduled-tasks',
    COMMENT_NOTIFICATION: 'comment-notification',
    DATA_TASK: 'comment-data-task',
    SOCIAL_SYNC: 'social-sync',
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
    [QUEUE_NAMES.DATA_TASK]: {
        defaultJobOptions: {
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 200 },
        },
    },
    [QUEUE_NAMES.SOCIAL_SYNC]: {
        defaultJobOptions: {
            removeOnComplete: { count: 200 },
            removeOnFail: { count: 500 },
        },
    },
};

let emailQueue = null;
let scheduledTasksQueue = null;
let commentNotificationQueue = null;
let dataTaskQueue = null;
let socialSyncQueue = null;

async function createQueues() {
    const sharedConnection = await createConnection('queue-shared');
    const socialSyncConnection = await createConnection('queue-social-sync');

    emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
        connection: sharedConnection,
        ...QUEUE_OPTIONS[QUEUE_NAMES.EMAIL],
    });

    scheduledTasksQueue = new Queue(QUEUE_NAMES.SCHEDULED_TASKS, {
        connection: sharedConnection,
        ...QUEUE_OPTIONS[QUEUE_NAMES.SCHEDULED_TASKS],
    });

    commentNotificationQueue = new Queue(QUEUE_NAMES.COMMENT_NOTIFICATION, {
        connection: sharedConnection,
        ...QUEUE_OPTIONS[QUEUE_NAMES.COMMENT_NOTIFICATION],
    });

    dataTaskQueue = new Queue(QUEUE_NAMES.DATA_TASK, {
        connection: sharedConnection,
        ...QUEUE_OPTIONS[QUEUE_NAMES.DATA_TASK],
    });

    socialSyncQueue = new Queue(QUEUE_NAMES.SOCIAL_SYNC, {
        connection: socialSyncConnection,
        ...QUEUE_OPTIONS[QUEUE_NAMES.SOCIAL_SYNC],
    });

    logger.info('[queues] All queues created');
    return { emailQueue, scheduledTasksQueue, commentNotificationQueue, dataTaskQueue, socialSyncQueue };
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

function getDataTaskQueue() {
    return dataTaskQueue;
}

function getSocialSyncQueue() {
    return socialSyncQueue;
}

export { createQueues, getEmailQueue, getScheduledTasksQueue, getCommentNotificationQueue, getDataTaskQueue, getSocialSyncQueue };
