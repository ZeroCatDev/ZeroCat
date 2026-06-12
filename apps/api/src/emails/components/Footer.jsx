import React from 'react';
import { Section, Text, Hr } from '@react-email/components';
import { colors } from './styles.js';

/**
 * Minimal left-aligned email footer — shadcn style
 * @param {Object} props
 * @param {string} props.siteName - Site name
 * @param {string} props.frontendUrl - Frontend URL
 * @param {number} props.year - Current year
 */
export default function Footer({ siteName, frontendUrl, year }) {
    return (
        <>
            <Hr style={{
                border: 'none',
                borderTop: `1px solid ${colors.border}`,
                margin: 0,
            }} />
            <Section style={{
                backgroundColor: colors.footerBg,
                padding: '20px 32px',
            }}>
                <Text style={{
                    margin: '0 0 4px',
                    fontSize: '13px',
                    color: colors.footerText,
                    lineHeight: '1.5',
                }}>
                    此邮件由{' '}
                    <a href={frontendUrl} style={{
                        color: colors.primary,
                        textDecoration: 'none',
                        fontWeight: '500',
                    }}>
                        {siteName}
                    </a>
                    {' '}自动发送
                </Text>
                <Text style={{
                    margin: 0,
                    fontSize: '12px',
                    color: colors.textLight,
                    lineHeight: '1.5',
                }}>
                    &copy; {year} {siteName}
                </Text>
            </Section>
        </>
    );
}
