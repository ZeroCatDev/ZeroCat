// 此文件已被弃用，邮件模板功能已迁移到 emailTemplateService.js
// 为了向后兼容，保留导出但使用新服务
import emailTemplateService from './emailTemplateService.js';
import logger from '../logger.js';

// 向后兼容的注册模板函数
const registrationTemplate = async (email, password) => {
    logger.warn('registrationTemplate is deprecated, use emailTemplateService.sendRegistrationNotification instead');
    const result = await emailTemplateService.renderTemplate('registration', { email, password });
    return result.html;
};

// 向后兼容的密码重置模板函数
const passwordResetTemplate = async (email, token) => {
    logger.warn('passwordResetTemplate is deprecated, use emailTemplateService.sendPasswordResetNotification instead');
    const result = await emailTemplateService.renderTemplate('password-reset', { email, resetToken: token });
    return result.html;
};

export {
    registrationTemplate,
    passwordResetTemplate,
};
