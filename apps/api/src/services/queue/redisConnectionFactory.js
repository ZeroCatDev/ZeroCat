import IORedis from 'ioredis';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';

const connections = new Map();

async function getRedisOptions() {
    const host = await zcconfig.get('redis.host') || 'localhost';
    const port = await zcconfig.get('redis.port') || 6379;
    const password = await zcconfig.get('redis.password') || undefined;
    const db = await zcconfig.get('bullmq.redis.db') || 0;

    return {
        host,
        port,
        password: password || undefined,
        db,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    };
}

async function createConnection(name) {
    const options = await getRedisOptions();
    const connection = new IORedis(options);

    connection.on('error', (err) => {
        logger.error(`[redis-factory] Connection "${name}" error:`, err.message);
    });

    connection.on('connect', () => {
        logger.debug(`[redis-factory] Connection "${name}" established`);
    });

    connections.set(name, connection);
    return connection;
}

async function closeAll() {
    const promises = [];
    for (const [name, connection] of connections.entries()) {
        logger.debug(`[redis-factory] Closing connection "${name}"...`);
        promises.push(connection.quit().catch((err) => {
            logger.warn(`[redis-factory] Error closing connection "${name}":`, err.message);
        }));
    }
    await Promise.all(promises);
    connections.clear();
    logger.info('[redis-factory] All connections closed');
}

export { createConnection, closeAll };
