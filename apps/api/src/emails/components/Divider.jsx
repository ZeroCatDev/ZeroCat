import React from 'react';
import { Hr } from '@react-email/components';
import { colors } from './styles.js';

/**
 * Subtle horizontal divider
 */
export default function Divider() {
    return (
        <Hr style={{
            border: 'none',
            borderTop: `1px solid ${colors.border}`,
            margin: '24px 0',
        }} />
    );
}
