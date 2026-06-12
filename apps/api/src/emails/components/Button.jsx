import React from 'react';
import { Button as EmailButton } from '@react-email/components';
import { colors, getButtonColor } from './styles.js';

/**
 * Shadcn-style action button for emails
 * @param {Object} props
 * @param {string} props.href - Button link URL
 * @param {React.ReactNode} props.children - Button text
 * @param {string} [props.variant='primary'] - Color variant: primary|secondary|danger|success|warning|info
 * @param {string} [props.size='default'] - Size: default|sm|lg
 */
export default function Button({ href, children, variant = 'primary', size = 'default', ...rest }) {
    const bg = getButtonColor(variant);
    const isWarning = variant === 'warning';

    const sizeMap = {
        sm: { padding: '8px 16px', fontSize: '13px' },
        default: { padding: '10px 20px', fontSize: '14px' },
        lg: { padding: '12px 24px', fontSize: '15px' },
    };
    const s = sizeMap[size] || sizeMap.default;

    return (
        <EmailButton
            href={href}
            style={{
                display: 'inline-block',
                padding: s.padding,
                backgroundColor: bg,
                color: isWarning ? '#1e293b' : '#ffffff',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: s.fontSize,
                fontWeight: '600',
                lineHeight: '1.2',
                letterSpacing: '-0.01em',
            }}
            {...rest}
        >
            {children}
        </EmailButton>
    );
}
