// 合并的数据库迁移脚本
import { PrismaClient, Prisma } from '@prisma/client';
import logger from '../../utils/logger.js';

const prisma = new PrismaClient();

async function main() {
  try {
    logger.info('Starting combined database migration...');

    // 1. 创建新的 ow_projects_list_items 表
    logger.info('Creating ow_projects_list_items table...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS ow_projects_list_items (
        id INT NOT NULL AUTO_INCREMENT,
        listid INT NOT NULL,
        projectid INT NOT NULL,
        createTime TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE INDEX unique_list_project (listid, projectid),
        INDEX idx_list_items (listid),
        INDEX idx_project_in_lists (projectid)
      )
    `;

    // 2. 迁移数据从旧结构到新结构
    logger.info('Migrating data from old structure to new structure...');
    
    // 获取所有列表
    const lists = await prisma.ow_projects_lists.findMany();
    
    for (const list of lists) {
      if (!list.list) continue;
      
      try {
        // 解析列表JSON
        const projectIds = JSON.parse(list.list);
        
        if (!Array.isArray(projectIds)) continue;
        
        // 添加每个项目到新结构
        for (const projectId of projectIds) {
          try {
            await prisma.$executeRaw`
              INSERT IGNORE INTO ow_projects_list_items (listid, projectid)
              VALUES (${list.id}, ${projectId})
            `;
          } catch (error) {
            logger.error(`Error adding project ${projectId} to list ${list.id}:`, error);
          }
        }
        
        logger.info(`Migrated list ${list.id} with ${projectIds.length} projects`);
      } catch (error) {
        logger.error(`Error migrating list ${list.id}:`, error);
      }
    }

    // 3. 检查并添加索引
    logger.info('Checking and adding indexes...');
    
    // 检查 idx_author_lists 索引是否存在
    const indexExists = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.statistics 
      WHERE table_schema = DATABASE() 
      AND table_name = 'ow_projects_lists' 
      AND index_name = 'idx_author_lists'
    `;
    
    // 如果索引不存在，则添加
    if (indexExists[0].count === 0) {
      await prisma.$executeRaw`
        ALTER TABLE ow_projects_lists
        ADD INDEX idx_author_lists (authorid)
      `;
      logger.info('Added idx_author_lists index');
    } else {
      logger.info('idx_author_lists index already exists');
    }

    // 4. 处理 ow_projects_stars 表
    logger.info('Processing ow_projects_stars table...');
    
    // 4.1 检查列是否存在，然后删除
    const columnsToCheck = ['type', 'value', 'listid'];
    
    for (const column of columnsToCheck) {
      const columnExists = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
        AND table_name = 'ow_projects_stars' 
        AND column_name = ${column}
      `;
      
      if (columnExists[0].count > 0) {
        await prisma.$executeRaw(
          Prisma.sql`ALTER TABLE ow_projects_stars DROP COLUMN ${Prisma.raw(column)}`
        );
        logger.info(`Dropped column ${column}`);
      }
    }
    
    // 4.2 清理重复的收藏记录
    logger.info('Cleaning up duplicate star records...');
    
    // 找出重复的记录
    const duplicateStars = await prisma.$queryRaw`
      SELECT userid, projectid, COUNT(*) as count
      FROM ow_projects_stars
      GROUP BY userid, projectid
      HAVING COUNT(*) > 1
    `;
    
    logger.info(`Found ${duplicateStars.length} groups of duplicate star records`);
    
    // 对每组重复记录，保留一个，删除其他
    for (const dup of duplicateStars) {
      const records = await prisma.$queryRaw`
        SELECT id FROM ow_projects_stars
        WHERE userid = ${dup.userid} AND projectid = ${dup.projectid}
        ORDER BY id
      `;
      
      // 保留第一个记录，删除其他
      if (records.length > 1) {
        const keepId = records[0].id;
        for (let i = 1; i < records.length; i++) {
          await prisma.$executeRaw`
            DELETE FROM ow_projects_stars
            WHERE id = ${records[i].id}
          `;
        }
        logger.info(`Kept star record ${keepId}, deleted ${records.length - 1} duplicates`);
      }
    }
    
    // 4.3 添加索引（如果不存在）
    const starIndexes = [
      { name: 'unique_user_project_star', columns: '(userid, projectid)', unique: true },
      { name: 'idx_project_stars', columns: '(projectid)', unique: false },
      { name: 'idx_user_stars', columns: '(userid)', unique: false }
    ];
    
    for (const index of starIndexes) {
      const indexExists = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM information_schema.statistics 
        WHERE table_schema = DATABASE() 
        AND table_name = 'ow_projects_stars' 
        AND index_name = ${index.name}
      `;
      
      if (indexExists[0].count === 0) {
        if (index.unique) {
          await prisma.$executeRaw(
            Prisma.sql`ALTER TABLE ow_projects_stars ADD UNIQUE INDEX ${Prisma.raw(index.name)} ${Prisma.raw(index.columns)}`
          );
        } else {
          await prisma.$executeRaw(
            Prisma.sql`ALTER TABLE ow_projects_stars ADD INDEX ${Prisma.raw(index.name)} ${Prisma.raw(index.columns)}`
          );
        }
        logger.info(`Added ${index.name} index`);
      } else {
        logger.info(`${index.name} index already exists`);
      }
    }

    // 5. 清理 ow_projects_list_items 表中的重复数据
    logger.info('Cleaning up duplicate list item records...');
    
    // 找出重复的记录
    const duplicateItems = await prisma.$queryRaw`
      SELECT listid, projectid, COUNT(*) as count
      FROM ow_projects_list_items
      GROUP BY listid, projectid
      HAVING COUNT(*) > 1
    `;
    
    logger.info(`Found ${duplicateItems.length} groups of duplicate list item records`);
    
    // 对每组重复记录，保留一个，删除其他
    for (const dup of duplicateItems) {
      const records = await prisma.$queryRaw`
        SELECT id FROM ow_projects_list_items
        WHERE listid = ${dup.listid} AND projectid = ${dup.projectid}
        ORDER BY id
      `;
      
      // 保留第一个记录，删除其他
      if (records.length > 1) {
        const keepId = records[0].id;
        for (let i = 1; i < records.length; i++) {
          await prisma.$executeRaw`
            DELETE FROM ow_projects_list_items
            WHERE id = ${records[i].id}
          `;
        }
        logger.info(`Kept list item record ${keepId}, deleted ${records.length - 1} duplicates`);
      }
    }
    
    // 6. 更新项目的收藏计数
    logger.info('Updating project star counts...');
    
    // 获取所有项目
    const projects = await prisma.ow_projects.findMany({
      select: { id: true }
    });
    
    for (const project of projects) {
      // 计算实际的收藏数
      const starCount = await prisma.ow_projects_stars.count({
        where: { projectid: project.id }
      });
      
      // 更新项目的收藏数
      await prisma.ow_projects.update({
        where: { id: project.id },
        data: { star_count: starCount }
      });
    }
    
    logger.info('Updated star counts for all projects');

    logger.info('Combined migration completed successfully!');
  } catch (error) {
    logger.error('Migration failed:', error);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 