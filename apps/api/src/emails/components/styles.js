/**
 * Email design system — shadcn-inspired, cool-toned
 * Slate/indigo palette, left-aligned, minimal borders
 */

export const colors = {
    // Primary accent (indigo)
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    primaryLight: '#eef2ff',
    primaryBorder: '#c7d2fe',

    // Semantic colors
    secondary: '#64748b',
    secondaryHover: '#475569',
    danger: '#ef4444',
    dangerHover: '#dc2626',
    success: '#22c55e',
    successHover: '#16a34a',
    warning: '#f59e0b',
    warningHover: '#d97706',
    info: '#3b82f6',
    infoHover: '#2563eb',

    // Neutrals (cool slate)
    bg: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    textLight: '#94a3b8',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',

    // Header — minimal, no heavy bg
    headerBg: '#ffffff',
    headerText: '#0f172a',
    headerBorder: '#e2e8f0',

    // Footer
    footerBg: '#f8fafc',
    footerText: '#64748b',
};

/**
 * Get button background color by variant
 */
export function getButtonColor(variant) {
    const map = {
        primary: colors.primary,
        secondary: colors.secondary,
        danger: colors.danger,
        success: colors.success,
        warning: colors.warning,
        info: colors.info,
    };
    return map[variant] || colors.primary;
}

/**
 * Common style objects — all left-aligned, shadcn spacing
 */
export const styles = {
    body: {
        backgroundColor: colors.bg,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans SC', sans-serif",
        margin: 0,
        padding: '32px 0',
    },
    card: {
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: colors.card,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${colors.border}`,
    },
    section: {
        padding: '32px',
    },
    heading: {
        fontSize: '22px',
        fontWeight: '700',
        color: colors.text,
        margin: '0 0 20px 0',
        lineHeight: '1.3',
        letterSpacing: '-0.025em',
    },
    text: {
        fontSize: '15px',
        lineHeight: '1.7',
        color: colors.textSecondary,
        margin: '0 0 12px 0',
    },
    textMuted: {
        fontSize: '14px',
        lineHeight: '1.6',
        color: colors.textMuted,
        margin: '0 0 12px 0',
    },
    link: {
        color: colors.primary,
        textDecoration: 'none',
    },
};
