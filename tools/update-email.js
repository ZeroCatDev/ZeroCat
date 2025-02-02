import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// 生成 Base32 格式的哈希值
const generateContactHash = () => {
  // 生成20字节的随机数据
  const buffer = crypto.randomBytes(20);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let base32 = '';
  
  for (let i = 0; i < buffer.length; i += 5) {
    const chunk = buffer.slice(i, i + 5);
    let bits = 0;
    let value = 0;
    
    for (let j = 0; j < chunk.length; j++) {
      value = (value << 8) | chunk[j];
      bits += 8;
      
      while (bits >= 5) {
        base32 += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    
    if (bits > 0) {
      base32 += alphabet[(value << (5 - bits)) & 31];
    }
  }
  
  return base32;
};

async function migrateEmails() {
  try {
    console.log('开始邮箱迁移...');

    // 获取所有用户
    const users = await prisma.ow_users.findMany({
      where: {
        email: {
          not: null
        }
      },
      select: {
        id: true,
        email: true
      }
    });

    console.log(`找到 ${users.length} 个用户需要迁移邮箱`);

    // 批量处理计数器
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // 检查邮箱是否已存在于联系方式表中
        const existingContact = await prisma.ow_users_contacts.findUnique({
          where: {
            contact_value: user.email
          }
        });

        if (existingContact) {
          console.log(`跳过已存在的邮箱: ${user.email}`);
          skipCount++;
          continue;
        }

        // 创建新的联系方式记录
        await prisma.ow_users_contacts.create({
          data: {
            user_id: user.id,
            contact_value: user.email,
            contact_hash: generateContactHash(),
            contact_type: 'email',
            is_primary: true,
            verified: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        successCount++;
        console.log(`成功迁移邮箱: ${user.email}`);
      } catch (error) {
        errorCount++;
        console.error(`迁移邮箱失败 ${user.email}:`, error);
      }
    }

    console.log('\n迁移完成!');
    console.log('统计信息:');
    console.log(`- 总用户数: ${users.length}`);
    console.log(`- 成功迁移: ${successCount}`);
    console.log(`- 已存在跳过: ${skipCount}`);
    console.log(`- 迁移失败: ${errorCount}`);

  } catch (error) {
    console.error('迁移过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
migrateEmails()
  .then(() => {
    console.log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });
