/**
 * 统一认证系统测试脚本
 */

import {
    sendVerificationCode,
    verifyEmailCode,
    verifyPassword,
    verifyCredentials,
    authenticate
} from '../src/services/auth/unifiedAuth.js';
import {
    generateSudoToken,
    verifySudoToken,
    revokeSudoToken,
    authenticateSudo
} from '../src/services/auth/sudoAuth.js';
import redisClient from '../src/services/redis.js';

const testUserId = 1; // 测试用户ID
const testEmail = 'test@example.com';
const testUsername = 'testuser';
const testPassword = 'test_password';

async function runUnifiedAuthTests() {
    console.log('🧪 开始统一认证系统测试...\n');
    
    try {
        // ===== 统一认证服务测试 =====
        console.log('🔐 === 统一认证服务测试 ===\n');

        // 测试1: 发送邮件验证码（登录目的）
        console.log('📧 测试1: 发送登录邮件验证码');
        try {
            const emailResult = await sendVerificationCode(testUserId, testEmail, 'login');
            if (emailResult.success) {
                console.log('✅ 登录验证码发送成功');
                console.log('📝 验证码ID:', emailResult.codeId);
                console.log('💬 消息:', emailResult.message);
            } else {
                console.log('⚠️ 登录验证码发送失败:', emailResult.message);
            }
        } catch (error) {
            console.log('⚠️ 登录验证码发送失败(可能未配置邮件服务):', error.message);
        }
        console.log('');

        // 测试2: 发送邮件验证码（sudo目的）
        console.log('📧 测试2: 发送sudo邮件验证码');
        try {
            const sudoEmailResult = await sendVerificationCode(testUserId, testEmail, 'sudo');
            if (sudoEmailResult.success) {
                console.log('✅ sudo验证码发送成功');
                console.log('📝 验证码ID:', sudoEmailResult.codeId);
                console.log('💬 消息:', sudoEmailResult.message);
            } else {
                console.log('⚠️ sudo验证码发送失败:', sudoEmailResult.message);
            }
        } catch (error) {
            console.log('⚠️ sudo验证码发送失败(可能未配置邮件服务):', error.message);
        }
        console.log('');

        // 测试3: 验证凭据（用户名+密码）
        console.log('🔍 测试3: 验证用户凭据（用户名+密码）');
        try {
            const credentialsResult = await verifyCredentials(testUsername, testPassword);
            console.log(credentialsResult.valid ? '✅ 凭据验证成功' : '⚠️ 凭据验证失败(可能用户不存在)');
            console.log('💬 验证消息:', credentialsResult.message);
            if (credentialsResult.user) {
                console.log('👤 用户信息:', {
                    id: credentialsResult.user.id,
                    username: credentialsResult.user.username,
                    email: credentialsResult.user.email
                });
            }
        } catch (error) {
            console.log('⚠️ 凭据验证测试失败:', error.message);
        }
        console.log('');

        // 测试4: 统一认证（密码方式登录）
        console.log('🔐 测试4: 统一认证（密码方式登录）');
        try {
            const loginAuthResult = await authenticate({
                method: 'password',
                purpose: 'login',
                identifier: testUsername,
                password: testPassword
            });
            console.log(loginAuthResult.success ? '✅ 登录认证成功' : '⚠️ 登录认证失败(可能用户不存在)');
            console.log('💬 认证消息:', loginAuthResult.message);
            if (loginAuthResult.user) {
                console.log('👤 登录用户:', loginAuthResult.user.username);
            }
        } catch (error) {
            console.log('⚠️ 登录认证测试失败:', error.message);
        }
        console.log('');

        // 测试5: 统一认证（密码方式sudo）
        console.log('🔐 测试5: 统一认证（密码方式sudo）');
        try {
            const sudoAuthResult = await authenticate({
                method: 'password',
                purpose: 'sudo',
                userId: testUserId,
                password: testPassword
            });
            console.log(sudoAuthResult.success ? '✅ sudo认证成功' : '⚠️ sudo认证失败(可能用户不存在)');
            console.log('💬 认证消息:', sudoAuthResult.message);
        } catch (error) {
            console.log('⚠️ sudo认证测试失败:', error.message);
        }
        console.log('');

        // ===== sudo系统测试 =====
        console.log('🛡️ === sudo系统测试 ===\n');

        // 测试6: 生成sudo令牌
        console.log('📝 测试6: 生成sudo令牌');
        const tokenResult = await generateSudoToken(testUserId);
        console.log('✅ sudo令牌生成成功:', tokenResult.token.substring(0, 16) + '...');
        console.log('⏰ 过期时间:', tokenResult.expiresAt);
        console.log('');

        const sudoToken = tokenResult.token;

        // 测试7: 验证sudo令牌
        console.log('🔍 测试7: 验证sudo令牌');
        const verifyResult = await verifySudoToken(sudoToken);
        console.log(verifyResult.valid ? '✅ sudo令牌验证成功' : '❌ sudo令牌验证失败');
        console.log('💬 验证消息:', verifyResult.message);
        console.log('👤 用户ID:', verifyResult.userId);
        console.log('');

        // 测试8: 使用统一认证进行sudo认证
        console.log('🔐 测试8: 使用统一认证进行sudo认证');
        try {
            const sudoAuthResult = await authenticateSudo(testUserId, {
                method: 'password',
                password: testPassword
            });
            console.log(sudoAuthResult.success ? '✅ sudo认证成功' : '⚠️ sudo认证失败(可能用户不存在)');
            console.log('💬 认证消息:', sudoAuthResult.message);
            if (sudoAuthResult.token) {
                console.log('🔑 新sudo令牌:', sudoAuthResult.token.substring(0, 16) + '...');
            }
        } catch (error) {
            console.log('⚠️ sudo认证测试失败:', error.message);
        }
        console.log('');

        // 测试9: 撤销sudo令牌
        console.log('🗑️ 测试9: 撤销sudo令牌');
        const revokeResult = await revokeSudoToken(sudoToken);
        console.log(revokeResult ? '✅ sudo令牌撤销成功' : '❌ sudo令牌撤销失败');
        console.log('');

        // 测试10: 验证已撤销的令牌
        console.log('🔍 测试10: 验证已撤销的sudo令牌');
        const revokedVerifyResult = await verifySudoToken(sudoToken);
        console.log(revokedVerifyResult.valid ? '❌ 已撤销令牌验证通过(异常!)' : '✅ 已撤销令牌验证失败(正常)');
        console.log('💬 验证消息:', revokedVerifyResult.message);
        console.log('');

        console.log('🎉 统一认证系统测试完成!');
        
        // 系统状态检查
        console.log('\n📊 系统状态检查:');
        console.log('Redis连接状态:', redisClient.isConnected ? '✅ 已连接' : '❌ 未连接');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    }
}

// API接口测试（需要服务器运行）
async function testAPIEndpoints() {
    console.log('\n🌐 === API接口测试 ===');
    console.log('注意：此部分需要服务器运行\n');
    
    const baseUrl = 'http://localhost:8080'; // 假设服务器运行在8080端口
    
    console.log('可以使用以下curl命令测试API接口：\n');
    
    console.log('1. 获取认证方法:');
    console.log(`curl -X GET "${baseUrl}/auth/methods?purpose=login"\n`);
    
    console.log('2. 发送登录验证码:');
    console.log(`curl -X POST "${baseUrl}/auth/send-code" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"${testEmail}","purpose":"login"}'\n`);
    
    console.log('3. 密码登录:');
    console.log(`curl -X POST "${baseUrl}/auth/authenticate" \\
  -H "Content-Type: application/json" \\
  -d '{"method":"password","purpose":"login","identifier":"${testUsername}","password":"${testPassword}"}'\n`);
    
    console.log('4. 发送sudo验证码:');
    console.log(`curl -X POST "${baseUrl}/auth/send-code" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"purpose":"sudo"}'\n`);
    
    console.log('5. sudo认证:');
    console.log(`curl -X POST "${baseUrl}/auth/authenticate" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"method":"password","purpose":"sudo","password":"${testPassword}"}'\n`);
}

// 运行所有测试
async function runAllTests() {
    await runUnifiedAuthTests();
    await testAPIEndpoints();
    
    console.log('\n✨ 所有测试完成');
    console.log('\n📚 使用说明:');
    console.log('1. 统一认证系统支持多种认证方式：password、email');
    console.log('2. 统一认证系统支持多种认证目的：login、sudo、reset_password、change_email、delete_account');
    console.log('3. 所有验证码都通过统一的服务管理，有效期5分钟');
    console.log('4. sudo令牌有效期15分钟，支持即时撤销');
    console.log('5. 推荐使用 /auth/* 接口替代原有的分散认证接口');
}

// 运行测试
runAllTests().then(() => {
    console.log('\n🏁 测试脚本执行完成');
}).catch(error => {
    console.error('❌ 测试脚本执行失败:', error);
});