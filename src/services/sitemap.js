import {createHash} from 'crypto';
import {SitemapStream, streamToPromise} from 'sitemap';
import {Readable} from 'stream';
import {createGzip} from 'zlib';
import {prisma} from './global.js';
import logger from './logger.js';
import zcconfig from './config/zcconfig.js';
import schedulerService from './scheduler.js';

class SitemapService {
    constructor() {
        this.isGenerating = false;
        this.TASK_ID = 'sitemap-auto-update';
    }

    async initialize() {
        const enabled = await zcconfig.get('sitemap.enabled');
        if (!enabled) {
            logger.info('[sitemap] Sitemap service is disabled');
            return;
        }

        const autoUpdate = await zcconfig.get('sitemap.auto_update');
        if (autoUpdate) {
            await this.setupAutoUpdate();
        }

        logger.info('[sitemap] Sitemap service initialized');
    }

    async setupAutoUpdate() {
        // 移除旧任务（如果存在）
        schedulerService.removeTask(this.TASK_ID);

        const updateCron = await zcconfig.get('sitemap.update_cron');
        // 将cron表达式转换为毫秒间隔（这里简化处理，使用24小时）
        const interval = 24 * 60 * 60 * 1000; // 24小时

        // 注册新任务
        schedulerService.registerTask(this.TASK_ID, {
            interval: interval,
            handler: async () => {
                try {
                    await this.generateIncrementalSitemap();
                } catch (error) {
                    logger.error('[sitemap] Auto update task error:', error);
                }
            },
            runImmediately: false
        });

        logger.info(`[sitemap] Auto update task scheduled with interval: ${interval}ms`);
    }

    async getUrls() {
        const urls = [];

        try {
            // 获取公开项目
            const projects = await prisma.ow_projects.findMany({
                where: {
                    state: 'public',
                    // 可以添加其他条件
                },
                select: {
                    id: true,
                    name: true,
                    time: true,
                    author: {
                        select: {
                            username: true
                        }
                    }
                },
                orderBy: {time: 'desc'}
            });

            // 获取活跃用户
            const users = await prisma.ow_users.findMany({
                where: {
                    status: 'active',
                    // 可以添加其他条件
                },
                select: {
                    id: true,
                    username: true,
                    loginTime: true
                }
            });

            // 添加项目URL
            for (const project of projects) {
                if (project.author?.username) {
                    urls.push({
                        url: `/${project.author.username}/${project.name}`,
                        changefreq: 'daily',
                        priority: 0.8,
                        lastmod: project.time
                    });
                }
            }

            // 添加用户主页URL
            for (const user of users) {
                urls.push({
                    url: `/${user.username}`,
                    changefreq: 'weekly',
                    priority: 0.7,
                    lastmod: user.loginTime
                });
            }

            // TODO: 添加其他动态URL
            // 例如：标签页、搜索页、分类页等
            // 需要根据实际业务逻辑添加

        } catch (error) {
            logger.error('[sitemap] Error collecting URLs:', error);
            throw error;
        }

        return urls;
    }

    async generateSitemap(isIncremental = false) {
        if (this.isGenerating) {
            throw new Error('Sitemap generation already in progress');
        }

        this.isGenerating = true;
        const frontendUrl = await zcconfig.get('urls.frontend');

        try {
            // 创建sitemap流
            const smStream = new SitemapStream({
                hostname: frontendUrl,
                xmlns: {news: false, xhtml: true, image: true, video: false}
            });

            // 使用gzip压缩
            const pipeline = smStream.pipe(createGzip());

            // 获取并写入URL
            const urls = await this.getUrls();
            const stream = Readable.from(urls).pipe(smStream);

            // 获取最终的buffer
            const buffer = await streamToPromise(pipeline);

            // 计算SHA256哈希
            const hash = createHash('sha256').update(buffer).digest('hex');

            // 保存到ow_projects_file
            await prisma.ow_projects_file.upsert({
                where: {sha256: hash},
                create: {
                    sha256: hash,
                    source: buffer.toString('base64'),
                    create_userid: 1 // 系统用户
                },
                update: {} // 内容不变，无需更新
            });

            // 更新配置
            await zcconfig.set('sitemap.current_file_hash', hash);

            if (isIncremental) {
                await zcconfig.set('sitemap.last_incremental_update', new Date().toISOString());
            } else {
                await zcconfig.set('sitemap.last_full_update', new Date().toISOString());
            }

            logger.info(`[sitemap] Generated sitemap with hash: ${hash}`);
            return hash;
        } catch (error) {
            logger.error('[sitemap] Error generating sitemap:', error);
            throw error;
        } finally {
            this.isGenerating = false;
        }
    }

    async generateFullSitemap() {
        return this.generateSitemap(false);
    }

    async generateIncrementalSitemap() {
        return this.generateSitemap(true);
    }

    async getCurrentSitemapHash() {
        return zcconfig.get('sitemap.current_file_hash');
    }

    async getSitemapStatus() {
        const [
            enabled,
            autoUpdate,
            updateCron,
            currentFileHash,
            lastFullUpdate,
            lastIncrementalUpdate
        ] = await Promise.all([
            zcconfig.get('sitemap.enabled'),
            zcconfig.get('sitemap.auto_update'),
            zcconfig.get('sitemap.update_cron'),
            zcconfig.get('sitemap.current_file_hash'),
            zcconfig.get('sitemap.last_full_update'),
            zcconfig.get('sitemap.last_incremental_update')
        ]);

        return {
            enabled,
            autoUpdate,
            updateCron,
            currentFileHash,
            lastFullUpdate,
            lastIncrementalUpdate,
            isGenerating: this.isGenerating,
            isTaskScheduled: schedulerService.isTaskRunning(this.TASK_ID)
        };
    }
}

// 创建单例实例
const sitemapService = new SitemapService();
export default sitemapService;