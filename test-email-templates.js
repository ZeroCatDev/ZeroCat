import emailTemplateService from './src/services/email/emailTemplateService.js';

/**
 * 测试邮件模板系统
 * 运行方式: node test-email-templates.js
 */
async function testEmailTemplateService() {
    try {
        console.log('开始测试邮件模板服务...');

        // 测试1: 渲染通用通知模板
        console.log('测试1: 渲染通用通知邮件模板');
        const notificationResult = await emailTemplateService.renderTemplate('notification', {
            title: '系统通知',
            content: '这是一条测试通知消息，用于验证邮件模板系统是否正常工作。',
            username: 'testuser',
            email: 'test@example.com',
            link: 'https://zerocat.top/notifications'
        });
        console.log('通用通知模板渲染成功:', notificationResult.subject);
        console.log('HTML内容长度:', notificationResult.html ? notificationResult.html.length : 0);
        console.log('文本内容:', notificationResult.text ? notificationResult.text.substring(0, 100) + '...' : '无文本内容');

        // 注意: EmailTemplateService快捷方法已被移除
        // 所有邮件发送现在都应使用createNotification函数
        console.log('\n说明: EmailTemplateService快捷方法已被移除');
        console.log('现在所有邮件发送都应通过createNotification函数完成');
        console.log('请参考loginController.js和email.js中的实现方式');

        console.log('\n邮件模板基础功能测试通过! ✅');
        console.log('EmailTemplateService核心方法正常工作');
        console.log('快捷方法已被移除，请使用createNotification发送邮件');

    } catch (error) {
        console.error('邮件模板测试失败:', error);
        process.exit(1);
    }
}

testEmailTemplateService().then(() => {
    console.log('测试完成');
    process.exit(0);
}).catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
});

export { testEmailTemplateService };