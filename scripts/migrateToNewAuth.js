import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routesDir = path.join(__dirname, '../routes');

// 定义需要迁移的文件和模式
const filesToMigrate = [
  'router_my.js',
  'router_scratch.js',
  'router_project.js',
  'router_account.js',
  'router_api.js',
  'router_comment.js',
  'router_user.js',
  'router_timeline.js',
  'router_projectlist.js',
  'router_search.js'
];

// 需要替换的模式
const patterns = [
  // 替换直接检查 res.locals.login 的模式
  {
    find: /if\s*\(\s*!res\.locals\.login\s*\)\s*{[^}]*}/gs,
    replace: '// Migrated to use needlogin middleware'
  },
  // 替换 router.all 中间件
  {
    find: /router\.all\s*\(\s*["']\/\{\*path\}["']\s*,\s*function\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*{\s*(?:[^}]*!res\.locals\.login[^}]*}\s*return;\s*}|[^}]*)\s*next\(\);\s*}\s*\);/gs,
    replace: '// Migrated to use the global parseToken middleware'
  },
  // 替换 checkLogin 函数
  {
    find: /const\s+checkLogin\s*=\s*\(\s*res\s*\)\s*=>\s*{\s*if\s*\(\s*!res\.locals\.login\s*\)\s*{[^}]*}\s*};/gs,
    replace: '// Migrated to use needlogin middleware'
  }
];

// 替换导入语句
const importReplacements = [
  {
    find: /import\s*{(?:[^}]*)}\s*from\s*["']\.\.\/middleware\/auth\.js["'];/g,
    replace: 'import { needlogin, strictTokenCheck, needadmin } from "../middleware/auth.js";'
  },
  {
    find: /import\s*{\s*needlogin\s*}\s*from\s*["']\.\.\/middleware\/auth\.js["'];/g,
    replace: 'import { needlogin, strictTokenCheck, needadmin } from "../middleware/auth.js";'
  },
  // 如果没有导入，添加导入
  {
    find: /^(import[^;]*;)(?!\s*import\s*{[^}]*}\s*from\s*["']\.\.\/middleware\/auth\.js["'];)/m,
    replace: '$1\nimport { needlogin, strictTokenCheck } from "../middleware/auth.js";'
  }
];

// 替换路由定义
const routeReplacements = [
  // 为没有验证的敏感路由添加 needlogin 中间件
  {
    find: /(router\.(?:post|put|delete)\s*\(\s*["'][^"']*["']\s*,\s*)(?!needlogin|strictTokenCheck)(function)/g,
    replace: '$1needlogin, $2'
  },
  // 为重要资源操作添加 strictTokenCheck 中间件
  {
    find: /(router\.(?:post|put|delete)\s*\(\s*["'][^"']*\/(?:admin|security|password|email|token|verify|delete)["']\s*,\s*)(?!strictTokenCheck)(function)/g,
    replace: '$1strictTokenCheck, $2'
  }
];

async function migrateFile(filePath) {
  try {
    logger.info(`Processing file: ${filePath}`);

    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // 应用导入替换
    for (const pattern of importReplacements) {
      if (!pattern.find.test(content)) {
        // 如果没有找到导入模式，查找第一个导入语句后添加
        if (pattern.find.toString().includes('(?!')  && /import\s+[^;]*;/.test(content)) {
          content = content.replace(/^(import[^;]*;)/m, '$1\nimport { needlogin, strictTokenCheck } from "../middleware/auth.js";');
        }
      } else {
        content = content.replace(pattern.find, pattern.replace);
      }
    }

    // 应用模式替换
    for (const pattern of patterns) {
      content = content.replace(pattern.find, pattern.replace);
    }

    // 应用路由替换
    for (const pattern of routeReplacements) {
      content = content.replace(pattern.find, pattern.replace);
    }

    // 如果内容有变化，写入文件
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      logger.info(`Successfully migrated file: ${filePath}`);
      return true;
    } else {
      logger.info(`No changes needed for file: ${filePath}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error migrating file ${filePath}: ${error.message}`);
    return false;
  }
}

async function migrateFiles() {
  logger.info('Starting migration process...');

  let migratedCount = 0;

  for (const file of filesToMigrate) {
    const filePath = path.join(routesDir, file);
    if (fs.existsSync(filePath)) {
      const success = await migrateFile(filePath);
      if (success) {
        migratedCount++;
      }
    } else {
      logger.warn(`File not found: ${filePath}`);
    }
  }

  logger.info(`Migration completed. ${migratedCount} files were migrated.`);
}

// 执行迁移
migrateFiles().catch(error => {
  logger.error(`Migration failed: ${error.message}`);
  process.exit(1);
});