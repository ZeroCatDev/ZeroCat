import { Queue } from 'bullmq';
import { createConnection } from './redisConnectionFactory.js';
import logger from '../logger.js';

export const QUEUE_NAMES = {
    EMAIL: 'email',
    SCHEDULED_TASKS: 'scheduled-tasks',
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
};

let emailQueue = null;
let scheduledTasksQueue = null;

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

    logger.info('[queues] All queues created');
    return { emailQueue, scheduledTasksQueue };
}

function getEmailQueue() {
    return emailQueue;
}

function getScheduledTasksQueue() {
    return scheduledTasksQueue;
}

export { createQueues, getEmailQueue, getScheduledTasksQueue };
