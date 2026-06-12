import React from 'react';
import { Html, Head, Body, Container, Preview, Font } from '@react-email/components';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import { colors, styles } from './styles.js';

/**
 * Root layout wrapper for all email templates
 * @param {Object} props
 * @param {string} props.previewText - Preview text shown in email clients
 * @param {string} props.siteName - Site name for header/footer
 * @param {string} props.frontendUrl - Frontend URL for footer link
 * @param {number} props.year - Current year for copyright
 * @param {React.ReactNode} props.children - Email content
 */
export default function Layout({ previewText, siteName, frontendUrl, year, children }) {
    return (
        <Html lang="zh-CN">
            <Head>
                <Font
                    fontFamily="system-ui"
                    fallbackFontFamily={['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans SC', 'sans-serif']}
                />
            </Head>
            <Preview>{previewText}</Preview>
            <Body style={styles.body}>
                <Container style={styles.card}>
                    <Header siteName={siteName} />
                    <div style={styles.section}>
                        {children}
                    </div>
                    <Footer siteName={siteName} frontendUrl={frontendUrl} year={year} />
                </Container>
            </Body>
        </Html>
    );
}
