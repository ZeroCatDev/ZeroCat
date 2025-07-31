#!/usr/bin/env node

/**
 * S3 Assets Migration Tool
 *
 * This tool migrates files from material/asset/ directory to assets/ directory
 * with a new folder structure based on the first 4 characters of the filename.
 *
 * Source format: material/asset/md5hash.extension
 * Target format: assets/AB/CD/md5hash.extension
 * Where AB are the first 2 characters and CD are the 3rd and 4th characters
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import zcconfig from '../src/services/config/zcconfig.js';
import logger from '../src/services/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class S3AssetsMigrator {
    constructor() {
        this.s3Client = null;
        this.bucketName = null;
        this.sourcePrefix = 'material/asset/';
        this.targetPrefix = 'assets/';
        this.dryRun = false;
        this.stats = {
            total: 0,
            processed: 0,
            skipped: 0,
            errors: 0
        };
    }

    async initialize() {
        try {
            // Initialize zcconfig
            await zcconfig.initialize();

            // Get S3 configuration
            const s3Config = {
                endpoint: await zcconfig.get('s3.endpoint'),
                region: await zcconfig.get('s3.region'),
                credentials: {
                    accessKeyId: await zcconfig.get('s3.AWS_ACCESS_KEY_ID'),
                    secretAccessKey: await zcconfig.get('s3.AWS_SECRET_ACCESS_KEY')
                }
            };

            this.bucketName = await zcconfig.get('s3.bucket');

            // Validate configuration
            if (!s3Config.endpoint || !s3Config.region || !s3Config.credentials.accessKeyId ||
                !s3Config.credentials.secretAccessKey || !this.bucketName) {
                throw new Error('S3配置不完整，请检查zcconfig中的S3相关配置');
            }

            // Initialize S3 client
            this.s3Client = new S3Client(s3Config);

            logger.info('[S3迁移] S3客户端初始化完成');
            logger.info(`[S3迁移] 存储桶: ${this.bucketName}`);
            logger.info(`[S3迁移] 源路径: ${this.sourcePrefix}`);
            logger.info(`[S3迁移] 目标路径: ${this.targetPrefix}`);

            return true;
        } catch (error) {
            logger.error('[S3迁移] 初始化失败:', error);
            throw error;
        }
    }

    /**
     * Generate target path from source filename
     * @param {string} filename - Original filename (e.g., "abcdef123456.jpg")
     * @returns {string} - Target path (e.g., "assets/ab/cd/abcdef123456.jpg")
     */
    generateTargetPath(filename) {
        if (filename.length < 4) {
            throw new Error(`文件名长度不足4个字符: ${filename}`);
        }

        const firstTwo = filename.substring(0, 2).toLowerCase();
        const nextTwo = filename.substring(2, 4).toLowerCase();

        return `${this.targetPrefix}${firstTwo}/${nextTwo}/${filename}`;
    }

    /**
     * List all files in the source directory
     */
    async listSourceFiles() {
        const files = [];
        let continuationToken = null;

        do {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: this.sourcePrefix,
                ContinuationToken: continuationToken
            });

            try {
                const response = await this.s3Client.send(command);

                if (response.Contents) {
                    for (const object of response.Contents) {
                        // Skip directories
                        if (object.Key.endsWith('/')) {
                            continue;
                        }

                        // Extract filename from full path
                        const filename = object.Key.replace(this.sourcePrefix, '');

                        // Skip if filename doesn't contain a dot (no extension)
                        if (!filename.includes('.')) {
                            logger.warn(`[S3迁移] 跳过无扩展名文件: ${filename}`);
                            continue;
                        }

                        files.push({
                            key: object.Key,
                            filename: filename,
                            size: object.Size,
                            lastModified: object.LastModified
                        });
                    }
                }

                continuationToken = response.NextContinuationToken;
            } catch (error) {
                logger.error('[S3迁移] 列举文件失败:', error);
                throw error;
            }
        } while (continuationToken);

        return files;
    }

    /**
     * Check if target file already exists
     */
    async targetExists(targetKey) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: targetKey
            });

            await this.s3Client.send(command);
            return true;
        } catch (error) {
            if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
                return false;
            }
            
            // Handle network errors and mirror issues
            if (error.name === 'MirrorFailed' || 
                error.message?.includes('502') || 
                error.message?.includes('mirror host') ||
                error.$metadata?.httpStatusCode === 502) {
                logger.warn(`[S3迁移] 网络错误检查目标文件 ${targetKey}，假设文件不存在: ${error.message}`);
                return false;
            }
            
            // Log the error but don't fail the entire process
            logger.warn(`[S3迁移] 检查目标文件存在性时出错 ${targetKey}: ${error.message}，假设文件不存在`);
            return false;
        }
    }

    /**
     * Copy file from source to target location
     */
    async copyFile(sourceKey, targetKey) {
        try {
            const copyCommand = new CopyObjectCommand({
                Bucket: this.bucketName,
                CopySource: `${this.bucketName}/${sourceKey}`,
                Key: targetKey
            });

            if (!this.dryRun) {
                await this.s3Client.send(copyCommand);
            }

            return true;
        } catch (error) {
            // Handle network errors and mirror issues more gracefully
            if (error.name === 'MirrorFailed' || 
                error.message?.includes('502') || 
                error.message?.includes('mirror host') ||
                error.$metadata?.httpStatusCode === 502) {
                logger.error(`[S3迁移] 网络错误复制文件 ${sourceKey} -> ${targetKey}: ${error.message}`);
                logger.info(`[S3迁移] 建议稍后重试该文件: ${sourceKey}`);
            } else {
                logger.error(`[S3迁移] 复制文件失败 ${sourceKey} -> ${targetKey}:`, error);
            }
            return false;
        }
    }

    /**
     * Process a single file
     */
    async processFile(file) {
        try {
            const targetKey = this.generateTargetPath(file.filename);

            // Check if target already exists
            if (await this.targetExists(targetKey)) {
                logger.info(`[S3迁移] 目标文件已存在，跳过: ${file.filename} -> ${targetKey}`);
                this.stats.skipped++;
                return;
            }

            // Copy file
            logger.info(`[S3迁移] ${this.dryRun ? '[DRY RUN] ' : ''}复制文件: ${file.filename} -> ${targetKey}`);

            const success = await this.copyFile(file.key, targetKey);

            if (success) {
                this.stats.processed++;
                logger.info(`[S3迁移] 复制成功: ${file.filename}`);
            } else {
                this.stats.errors++;
            }

        } catch (error) {
            logger.error(`[S3迁移] 处理文件失败: ${file.filename}`, error);
            this.stats.errors++;
        }
    }

    /**
     * Run the migration
     */
    async migrate(options = {}) {
        this.dryRun = options.dryRun || false;

        try {
            logger.info(`[S3迁移] 开始迁移${this.dryRun ? ' (DRY RUN 模式)' : ''}`);

            // List all source files
            logger.info('[S3迁移] 列举源文件...');
            const files = await this.listSourceFiles();
            this.stats.total = files.length;

            logger.info(`[S3迁移] 找到 ${files.length} 个文件`);

            if (files.length === 0) {
                logger.info('[S3迁移] 没有找到需要迁移的文件');
                return;
            }

            // Process files in batches to avoid overwhelming S3
            const batchSize = 10;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                const promises = batch.map(file => this.processFile(file));

                await Promise.all(promises);

                logger.info(`[S3迁移] 进度: ${Math.min(i + batchSize, files.length)}/${files.length}`);

                // Small delay between batches
                if (i + batchSize < files.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Print final statistics
            logger.info('[S3迁移] 迁移完成');
            logger.info(`[S3迁移] 统计信息:`);
            logger.info(`  - 总文件数: ${this.stats.total}`);
            logger.info(`  - 已处理: ${this.stats.processed}`);
            logger.info(`  - 已跳过: ${this.stats.skipped}`);
            logger.info(`  - 错误数: ${this.stats.errors}`);

        } catch (error) {
            logger.error('[S3迁移] 迁移过程中发生错误:', error);
            throw error;
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('-d');
    const help = args.includes('--help') || args.includes('-h');

    if (help) {
        console.log(`
S3 Assets Migration Tool

用法:
  node migrate-s3-assets.js [选项]

选项:
  --dry-run, -d    执行预演模式，不实际复制文件
  --help, -h       显示帮助信息

说明:
  此工具将 material/asset/ 目录下的所有文件迁移到 assets/ 目录
  新的目录结构基于文件名的前4个字符：

  源格式: material/asset/abcdef123456.jpg
  目标格式: assets/ab/cd/abcdef123456.jpg

  其中 ab 是文件名的前两个字符，cd 是第3、4个字符
`);
        process.exit(0);
    }

    const migrator = new S3AssetsMigrator();

    try {
        await migrator.initialize();
        await migrator.migrate({ dryRun });
    } catch (error) {
        logger.error('[S3迁移] 程序执行失败:', error);
        process.exit(1);
    }
}


    main().catch(error => {
        console.error('程序异常退出:', error);
        process.exit(1);
    });


export default S3AssetsMigrator;