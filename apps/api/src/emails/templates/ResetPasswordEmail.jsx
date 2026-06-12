import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { Layout, Button, Divider, colors } from '../components/index.js';

/**
 * Password reset verification email template
 *
 * @param {Object} props
 * @param {string} props.code - Verification code
 * @param {string} [props.resetUrl] - Password reset URL
 * @param {string} props.siteName - Site name
 * @param {string} props.frontendUrl - Frontend URL
 * @param {number} props.year - Current year
 */
export default function ResetPasswordEmail({
    code,
    resetUrl,
    siteName,
    frontendUrl,
    year,
}) {
    return (
        <Layout
            previewText="重置密码验证"
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
                重置密码验证
            </Heading>

            <Text style={{
                fontSize: '15px',
                lineHeight: '1.7',
                color: colors.textSecondary,
                margin: '0 0 16px',
            }}>
                您正在重置密码，验证码是：
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

            {resetUrl && (
                <div style={{ margin: '20px 0' }}>
                    <Button href={resetUrl}>重置密码</Button>
                </div>
            )}

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
