/**
 * sudo认证系统测试脚本
 */

import {
    generateSudoToken,
    verifySudoToken,
    revokeSudoToken,
    sendEmailVerificationCode,
    verifyEmailCode,
    verifyUserPassword,
    authenticateSudo
} from '../src/services/auth/sudoAuth.js';
import redisClient from '../src/services/redis.js';

const testUserId = 1; // 测试用户ID
const testEmail = 'test@example.com';

async function runTests() {
    console.log('🧪 开始sudo认证系统测试...\n');
    
    try {
        // 测试1: 生成sudo令牌
        console.log('📝 测试1: 生成sudo令牌');
        const tokenResult = await generateSudoToken(testUserId);
        console.log('✅ sudo令牌生成成功:', tokenResult.token.substring(0, 16) + '...');
        console.log('⏰ 过期时间:', tokenResult.expiresAt);
        console.log('');

        const sudoToken = tokenResult.token;

        // 测试2: 验证sudo令牌
        console.log('🔍 测试2: 验证sudo令牌');
        const verifyResult = await verifySudoToken(sudoToken);
        console.log(verifyResult.valid ? '✅ sudo令牌验证成功' : '❌ sudo令牌验证失败');
        console.log('💬 验证消息:', verifyResult.message);
        console.log('👤 用户ID:', verifyResult.userId);
        console.log('');

        // 测试3: 验证无效令牌
        console.log('🔍 测试3: 验证无效sudo令牌');
        const invalidVerifyResult = await verifySudoToken('invalid_token');
        console.log(invalidVerifyResult.valid ? '❌ 无效令牌验证通过(异常!)' : '✅ 无效令牌验证失败(正常)');
        console.log('💬 验证消息:', invalidVerifyResult.message);
        console.log('');

        // 测试4: 发送邮件验证码（如果邮件配置正确）
        console.log('📧 测试4: 发送邮件验证码');
        try {
            const emailResult = await sendEmailVerificationCode(testUserId, testEmail);
            if (emailResult.success) {
                console.log('✅ 邮件验证码发送成功');
                console.log('💬 消息:', emailResult.message);
            } else {
                console.log('⚠️ 邮件验证码发送失败:', emailResult.message);
            }
        } catch (error) {
            console.log('⚠️ 邮件验证码发送失败(可能未配置邮件服务):', error.message);
        }
        console.log('');

        // 测试5: 统一认证（密码方式 - 需要真实用户）
        console.log('🔐 测试5: 统一认证(密码方式)');
        try {
            const authResult = await authenticateSudo(testUserId, {
                method: 'password',
                password: 'test_password'
            });
            console.log(authResult.success ? '✅ 密码认证成功' : '⚠️ 密码认证失败(可能用户不存在或密码错误)');
            console.log('💬 认证消息:', authResult.message);
        } catch (error) {
            console.log('⚠️ 密码认证测试失败:', error.message);
        }
        console.log('');

        // 测试6: 撤销sudo令牌
        console.log('🗑️ 测试6: 撤销sudo令牌');
        const revokeResult = await revokeSudoToken(sudoToken);
        console.log(revokeResult ? '✅ sudo令牌撤销成功' : '❌ sudo令牌撤销失败');
        console.log('');

        // 测试7: 验证已撤销的令牌
        console.log('🔍 测试7: 验证已撤销的sudo令牌');
        const revokedVerifyResult = await verifySudoToken(sudoToken);
        console.log(revokedVerifyResult.valid ? '❌ 已撤销令牌验证通过(异常!)' : '✅ 已撤销令牌验证失败(正常)');
        console.log('💬 验证消息:', revokedVerifyResult.message);
        console.log('');

        console.log('🎉 sudo认证系统测试完成!');
        
        // Redis连接状态检查
        console.log('\n📊 Redis连接状态:');
        console.log('连接状态:', redisClient.isConnected ? '✅ 已连接' : '❌ 未连接');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    }
}

// 运行测试
runTests().then(() => {
    console.log('\n✨ 测试脚本执行完成');
}).catch(error => {
    console.error('❌ 测试脚本执行失败:', error);
});