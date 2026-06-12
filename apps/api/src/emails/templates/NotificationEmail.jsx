import React from 'react';
import { Heading, Text } from '@react-email/components';
import { Layout, Button, UserInfo, Divider, colors } from '../components/index.js';

/**
 * General notification email template
 *
 * @param {Object} props
 * @param {string} props.title - Notification title
 * @param {string} props.content - Notification content (plain text, may contain \n)
 * @param {string} [props.username] - User display name
 * @param {string|number} [props.userId] - User ID
 * @param {string} [props.link] - Action link URL
 * @param {Array<{url: string, text: string, style?: string}>} [props.buttons] - Action buttons
 * @param {string} props.siteName - Site name
 * @param {string} props.frontendUrl - Frontend URL
 * @param {number} props.year - Current year
 */
export default function NotificationEmail({
    title,
    content,
    username,
    userId,
    link,
    buttons,
    siteName,
    frontendUrl,
    year,
}) {
    const contentLines = content ? content.split('\n') : [];

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

            <div style={{ marginBottom: '20px' }}>
                {contentLines.map((line, i) => (
                    <Text key={i} style={{
                        fontSize: '15px',
                        lineHeight: '1.7',
                        color: colors.textSecondary,
                        margin: '0 0 8px',
                        whiteSpace: 'pre-line',
                    }}>
                        {line || ' '}
                    </Text>
                ))}
            </div>

            {username && (
                <UserInfo username={username} userId={userId} />
            )}

            {(buttons?.length > 0 || link) && (
                <div style={{ margin: '20px 0' }}>
                    {buttons?.length > 0 ? (
                        buttons.map((btn, i) => (
                            <Button key={i} href={btn.url} variant={btn.style}>
                                {btn.text}
                            </Button>
                        ))
                    ) : link ? (
                        <Button href={link}>查看详情</Button>
                    ) : null}
                </div>
            )}

            <Divider />

            <Text style={{
                fontSize: '14px',
                color: colors.textMuted,
                lineHeight: '1.6',
                margin: 0,
            }}>
                如果您没有请求此操作，请忽略此邮件。如有疑问，请联系我们的支持团队。
            </Text>
        </Layout>
    );
}
