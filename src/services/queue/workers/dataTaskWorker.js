import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import {
    exportSpaceData,
    importSpaceData,
    updateTask,
    notifyTaskComplete,
} from '../../commentService/dataService.js';
import logger from '../../logger.js';

let worker = null;

async function processDataTask(job) {
    const { taskId, type, spaceId, spaceCuid, spaceName, userId, importData } = job.data;

    await job.log(`Processing ${type} task ${taskId} for space ${spaceCuid}`);
    await updateTask(taskId, { status: 'processing' });

    const progressCb = async (processed, total) => {
        const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
        await job.updateProgress(progress);
        await updateTask(taskId, { progress, processed, total });
    };

    try {
        let result;

        if (type === 'export') {
            result = await exportSpaceData(spaceId, spaceCuid, spaceName, taskId, progressCb);
        } else if (type === 'import') {
            result = await importSpaceData(spaceId, importData, taskId, progressCb);
        } else {
            throw new Error(`Unknown task type: ${type}`);
        }

        await updateTask(taskId, {
            status: 'completed',
            progress: 100,
            completed_at: new Date().toISOString(),
            result,
        });

        await notifyTaskComplete(userId, type, spaceName, result);

        await job.log(`Task ${taskId} completed`);
        return result;
    } catch (error) {
        await updateTask(taskId, {
            status: 'failed',
            error: error.message,
            completed_at: new Date().toISOString(),
        });

        await notifyTaskComplete(userId, type, spaceName, null, error.message);

        throw error;
    }
}

async function createDataTaskWorker() {
    const connection = await createConnection('worker-data-task');

    worker = new Worker(
        QUEUE_NAMES.DATA_TASK,
        processDataTask,
        {
            connection,
            concurrency: 1,
            limiter: { max: 5, duration: 60000 },
        }
    );

    worker.on('completed', (job) => {
        logger.debug(`[data-task] Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        logger.error(`[data-task] Job ${job?.id} failed:`, err.message);
    });
    worker.on('error', (err) => {
        logger.error('[data-task] Worker error:', err.message);
    });

    logger.info('[data-task] Data task worker started');
    return worker;
}

function getDataTaskWorker() {
    return worker;
}

export { createDataTaskWorker, getDataTaskWorker };
