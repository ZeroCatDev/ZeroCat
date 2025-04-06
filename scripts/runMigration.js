import { execSync } from 'child_process';
import logger from '../utils/logger.js';

// 创建备份文件夹
try {


  // 执行迁移脚本
  logger.info('Starting migration...');
  import('./migrateToNewAuth.js')
    .then(() => {
      logger.info('Migration completed successfully');
    })
    .catch((error) => {
      logger.error(`Migration failed: ${error.message}`);
      logger.info('Restoring from backup...')
    });
} catch (error) {
  logger.error(`Setup failed: ${error.message}`);
}