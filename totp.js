import { PrismaClient } from '@prisma/client';
import OTPAuth from 'otpauth';

const prisma = new PrismaClient();

async function validateUserTotp(userId, token) {
  // 获取该用户的所有 TOTP 配置信息
  const userTotps = await prisma.userTotp.findMany({
    where: {
      userId: userId,  // 根据userId查找该用户的所有TOTP配置
      enabled: true,    // 仅验证启用的TOTP配置
    },
  });

  if (userTotps.length === 0) {
    console.log('没有找到启用的TOTP配置');
    return false;
  }

  // 遍历所有的TOTP配置，逐个验证令牌
  for (let totpConfig of userTotps) {
    // 创建TOTP实例
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(totpConfig.secret),  // 从数据库中获取的密钥
      algorithm: totpConfig.algorithm,  // 使用配置中的算法
      digits: totpConfig.digits,        // 使用配置中的位数
      period: totpConfig.period,        // 使用配置中的有效期
    });

    // 验证令牌
    const delta = totp.validate({ token, window: 1 });
    if (delta !== null) {
      // 找到有效的令牌，返回验证通过
      console.log('令牌验证通过');
      return true;
    }
  }

  // 如果所有配置的令牌都无效
  console.log('令牌验证失败');
  return false;
}

// 假设用户ID是1，输入的TOTP令牌是'123456'
validateUserTotp(1, '123456')
  .catch(e => {
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
