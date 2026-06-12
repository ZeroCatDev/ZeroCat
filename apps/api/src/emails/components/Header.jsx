import React from 'react';
import { Section, Heading, Hr } from '@react-email/components';
import { colors } from './styles.js';

/**
 * Minimal left-aligned email header — shadcn style
 * @param {Object} props
 * @param {string} props.siteName - Site name to display
 */
export default function Header({ siteName }) {
    return (
        <>
            <Section style={{
                backgroundColor: colors.headerBg,
                padding: '28px 32px 20px',
            }}>
                <Heading style={{
                    margin: 0,
                    fontSize: '24px',
                    fontWeight: '700',
                    color: colors.headerText,
                    letterSpacing: '-0.04em',
                }}>
                    {siteName}
                </Heading>
            </Section>
            <Hr style={{
                border: 'none',
                borderTop: `1px solid ${colors.border}`,
                margin: 0,
            }} />
        </>
    );
}
