import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import memoryCache from '../../memoryCache.js';
import logger from '../../logger.js';

let worker = null;

const taskHandlers = new Map();

// Register built-in task handlers
taskHandlers.set('hourly-cleanup', async (data, job) => {
    await job.log('Executing hourly cleanup');
});

taskHandlers.set('daily-stats', async (data, job) => {
    await job.log('Executing daily stats');
});

taskHandlers.set('memory-cache-cleanup', async (data, job) => {
    await job.log('Executing memory cache cleanup');
    memoryCache.cleanup();
    await job.log('Memory cache cleanup done');
});

taskHandlers.set('extension-sync', async (data, job) => {
    await job.log('Executing extension sync');
    try {
        const { getAllApprovedProjectIds } = await import('../../extensionReview.js');
        const { prisma } = await import('../../prisma.js');
        const approvedIds = await getAllApprovedProjectIds();
        await job.log(`Found ${approvedIds.length} approved extensions`);

        let synced = 0;
        for (const projectId of approvedIds) {
            const project = await prisma.ow_projects.findUnique({
                where: { id: projectId },
            });
            if (!project) continue;

            await prisma.ow_scratch_extensions.upsert({
                where: { projectid: projectId },
                update: { status: 'verified', commit: 'latest' },
                create: {
                    projectid: projectId,
                    status: 'verified',
                    commit: 'latest',
                    branch: project.default_branch || '',
                    image: '',
                },
            });
            synced++;
        }

        await job.log(`Synced ${synced} extensions`);
    } catch (err) {
        await job.log(`ERROR: extension-sync failed: ${err.message}`);
        throw err;
    }
});

taskHandlers.set('sitemap-auto-update', async (data, job) => {
    await job.log('Executing sitemap auto update');
    try {
        const sitemapService = (await import('../../sitemap.js')).default;
        await sitemapService.generateIncrementalSitemap();
        await job.log('Sitemap updated successfully');
    } catch (err) {
        await job.log(`ERROR: sitemap-auto-update failed: ${err.message}`);
        throw err;
    }
});

function registerTaskHandler(name, handler) {
    taskHandlers.set(name, handler);
    logger.info(`[scheduled-worker] Task handler "${name}" registered`);
}

async function createScheduledTasksWorker() {
    const connection = await createConnection('worker-scheduled');

    worker = new Worker(
        QUEUE_NAMES.SCHEDULED_TASKS,
        async (job) => {
            const taskName = job.name;
            await job.log(`Starting task "${taskName}"`);

            const handler = taskHandlers.get(taskName);
            if (!handler) {
                await job.log(`ERROR: No handler registered for task "${taskName}"`);
                throw new Error(`No handler registered for task "${taskName}"`);
            }

            await handler(job.data, job);
            await job.log(`Task "${taskName}" completed`);
            return { task: taskName, completedAt: new Date().toISOString() };
        },
        {
            connection,
            concurrency: 1,
        }
    );

    worker.on('completed', (job) => {
        logger.debug(`[scheduled-worker] Job ${job.id} (${job.name}) completed`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[scheduled-worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
    });

    worker.on('error', (err) => {
        logger.error('[scheduled-worker] Worker error:', err.message);
    });

    logger.info('[scheduled-worker] Scheduled tasks worker started');
    return worker;
}

function getScheduledTasksWorker() {
    return worker;
}

export { createScheduledTasksWorker, getScheduledTasksWorker, registerTaskHandler };
