import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { Layout, Button, Divider, colors } from '../components/index.js';

/**
 * Email verification code template
 *
 * @param {Object} props
 * @param {string} props.code - Verification code
 * @param {string} [props.verifyUrl] - Verification URL
 * @param {string} [props.purpose='verify'] - Purpose: verify|add_email
 * @param {string} props.siteName - Site name
 * @param {string} props.frontendUrl - Frontend URL
 * @param {number} props.year - Current year
 */
export default function VerificationEmail({
    code,
    verifyUrl,
    purpose = 'verify',
    siteName,
    frontendUrl,
    year,
}) {
    const titleMap = {
        verify: '验证您的邮箱',
        add_email: '验证新邮箱',
    };
    const title = titleMap[purpose] || '验证您的邮箱';

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
                margin: '0 0 16px',
            }}>
                您的验证码是：
            </Text>

            {/* Verification code — left-aligned card */}
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

            <Text style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: colors.textMuted,
                margin: '0 0 20px',
            }}>
                此验证码将在 5 分钟内有效。
            </Text>

            {verifyUrl && (
                <div style={{ margin: '20px 0' }}>
                    <Button href={verifyUrl}>验证邮箱</Button>
                </div>
            )}

            {verifyUrl && (
                <Text style={{
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: colors.textLight,
                    margin: '0 0 16px',
                }}>
                    或点击链接完成验证：<br />
                    <a href={verifyUrl} style={{ color: colors.primary, wordBreak: 'break-all' }}>
                        {verifyUrl}
                    </a>
                </Text>
            )}

            <Divider />

            <Text style={{
                fontSize: '14px',
                color: colors.textMuted,
                lineHeight: '1.6',
                margin: 0,
            }}>
                如果这不是您的操作，请忽略此邮件。
            </Text>
        </Layout>
    );
}
