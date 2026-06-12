import React from 'react';
import { Section, Text } from '@react-email/components';
import { colors } from './styles.js';

/**
 * Shadcn-style user info panel
 * @param {Object} props
 * @param {string} props.username - Display name
 * @param {string|number} [props.userId] - Optional user ID
 */
export default function UserInfo({ username, userId }) {
    return (
        <Section style={{
            backgroundColor: colors.borderLight,
            border: `1px solid ${colors.border}`,
            padding: '14px 16px',
            margin: '16px 0',
            borderRadius: '8px',
        }}>
            <Text style={{
                margin: '0 0 4px',
                fontSize: '14px',
                color: colors.text,
                fontWeight: '600',
                lineHeight: '1.5',
            }}>
                {username}
            </Text>
            {userId && (
                <Text style={{
                    margin: 0,
                    fontSize: '13px',
                    color: colors.textMuted,
                    lineHeight: '1.5',
                }}>
                    ID: {userId}
                </Text>
            )}
        </Section>
    );
}
