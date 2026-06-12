import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { Layout, Button, Divider, colors } from '../components/index.js';

/**
 * Magic link / login verification email template
 *
 * @param {Object} props
 * @param {string} [props.code] - Verification code (for code-based auth)
 * @param {string} [props.magicLink] - Magic link URL
 * @param {string} [props.purpose='login'] - Purpose: login|register|password_reset|unlink_oauth
 * @param {string} props.siteName - Site name
 * @param {string} props.frontendUrl - Frontend URL
 * @param {number} props.year - Current year
 */
export default function MagicLinkEmail({
    code,
    magicLink,
    purpose = 'login',
    siteName,
    frontendUrl,
    year,
}) {
    const titleMap = {
        login: '登录验证',
        register: '完成账户注册',
        password_reset: '密码重置',
        unlink_oauth: '解绑 OAuth 验证',
    };

    const contentMap = {
        login: '您正在使用邮箱验证码登录',
        register: '点击下方链接完成您的账户注册',
        password_reset: '点击下方链接重置您的密码',
        unlink_oauth: '您正在请求解绑 OAuth 账号',
    };

    const title = titleMap[purpose] || '登录验证';
    const content = contentMap[purpose] || '请使用以下信息完成操作';

    return (
        <Layout
            previewText={title}
            siteName={siteName}
            frontendUrl={frontendUrl}
            year={year}
        >
            <Heading style={{
                fontSize: '22px',
                fontWeight: '700',
                color: colors.text,
                margin: '0 0 20px',
                lineHeight: '1.3',
                letterSpacing: '-0.025em',
            }}>
                {title}
            </Heading>

            <Text style={{
                fontSize: '15px',
                lineHeight: '1.7',
                color: colors.textSecondary,
                margin: '0 0 20px',
            }}>
                {content}
            </Text>

            {/* Verification code — left-aligned card */}
            {code && (
                <>
                    <Text style={{
                        fontSize: '15px',
                        lineHeight: '1.7',
                        color: colors.textSecondary,
                        margin: '0 0 12px',
                    }}>
                        您的验证码是：
                    </Text>

                    <Section style={{
                        backgroundColor: colors.borderLight,
                        borderRadius: '8px',
                        padding: '16px 20px',
                        margin: '0 0 20px',
                        border: `1px solid ${colors.border}`,
                    }}>
                        <Text style={{
                            fontSize: '28px',
                            fontWeight: '700',
                            color: colors.primary,
                            margin: 0,
                            letterSpacing: '0.12em',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        }}>
                            {code}
                        </Text>
                    </Section>
                </>
            )}

            {/* Magic link button */}
            {magicLink && (
                <div style={{ margin: '20px 0' }}>
                    <Button href={magicLink}>
                        {purpose === 'register' ? '完成注册' : '点击登录'}
                    </Button>
                </div>
            )}

            <Text style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: colors.textMuted,
                margin: '0 0 16px',
            }}>
                此{code ? '验证码' : '链接'}将在{purpose === 'login' || purpose === 'unlink_oauth' ? '5分钟' : '30分钟'}内有效。
            </Text>

            <Divider />

            <Text style={{
                fontSize: '14px',
                color: colors.textMuted,
                lineHeight: '1.6',
                margin: 0,
            }}>
                如果这不是您的操作，请忽略此邮件并考虑修改您的密码。
            </Text>
        </Layout>
    );
}
