import React from 'react';
import { Section, Text } from '@react-email/components';
import { colors } from './styles.js';

/**
 * Shadcn-style quote block with subtle left accent
 * @param {Object} props
 * @param {string} [props.label] - Small label above content
 * @param {React.ReactNode} props.children - Quote content
 * @param {string} [props.variant='default'] - 'default' (accent) or 'parent' (muted)
 */
export default function QuoteBox({ label, children, variant = 'default' }) {
    const isParent = variant === 'parent';

    return (
        <Section style={{
            backgroundColor: isParent ? colors.borderLight : colors.primaryLight,
            borderLeft: `3px solid ${isParent ? colors.border : colors.primary}`,
            padding: '14px 16px',
            margin: '16px 0',
            borderRadius: '0 8px 8px 0',
            wordBreak: 'break-word',
        }}>
            {label && (
                <Text style={{
                    margin: '0 0 8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: isParent ? colors.textLight : colors.primary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                }}>
                    {label}
                </Text>
            )}
            {children}
        </Section>
    );
}
