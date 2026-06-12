import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { Layout, Button, QuoteBox, Divider, colors } from '../components/index.js';

/**
 * Comment notification email template
 *
 * @param {Object} props
 * @param {string} props.title - Email title
 * @param {string} [props.spaceName] - Comment space name
 * @param {string} props.nick - Commenter nickname
 * @param {string} [props.pageUrl] - Page URL where comment was made
 * @param {string} [props.time] - Comment time
 * @param {string} props.commentHtml - Sanitized HTML of the comment
 * @param {string} [props.parentNick] - Parent comment author nickname
 * @param {string} [props.parentHtml] - Sanitized HTML of parent comment
 * @param {Array<{url: string, text: string, style?: string}>} [props.buttons] - Action buttons
 * @param {string} [props.link] - Fallback action link
 * @param {string} props.siteName - Site name
 * @param {string} props.frontendUrl - Frontend URL
 * @param {number} props.year - Current year
 */
export default function CommentNotificationEmail({
    title,
    spaceName,
    nick,
    pageUrl,
    time,
    commentHtml,
    parentNick,
    parentHtml,
    buttons,
    link,
    siteName,
    frontendUrl,
    year,
}) {
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
                margin: '0 0 16px',
                lineHeight: '1.3',
                letterSpacing: '-0.025em',
            }}>
                {title}
            </Heading>

            {/* Metadata */}
            <Section style={{
                padding: '0',
                margin: '0 0 20px',
            }}>
                <Text style={{
                    margin: '0 0 4px',
                    fontSize: '15px',
                    color: colors.text,
                    fontWeight: '600',
                }}>
                    {nick}
                </Text>
                {pageUrl && (
                    <Text style={{
                        margin: '0 0 2px',
                        fontSize: '13px',
                        color: colors.textMuted,
                    }}>
                        页面: {pageUrl}
                    </Text>
                )}
                {time && (
                    <Text style={{
                        margin: 0,
                        fontSize: '13px',
                        color: colors.textMuted,
                    }}>
                        {time}
                    </Text>
                )}
            </Section>

            {/* Comment content */}
            <QuoteBox label="评论内容">
                <div dangerouslySetInnerHTML={{ __html: commentHtml }} />
            </QuoteBox>

            {/* Parent comment (if reply) */}
            {parentNick && parentHtml && (
                <QuoteBox label={`${parentNick} 的原评论`} variant="parent">
                    <div dangerouslySetInnerHTML={{ __html: parentHtml }} />
                </QuoteBox>
            )}

            {/* Action buttons */}
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
        </Layout>
    );
}
