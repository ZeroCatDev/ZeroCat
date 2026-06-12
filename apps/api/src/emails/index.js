/**
 * Email template registry
 * Maps template name strings to React components
 */
import NotificationEmail from './templates/NotificationEmail.jsx';
import CommentNotificationEmail from './templates/CommentNotificationEmail.jsx';
import VerificationEmail from './templates/VerificationEmail.jsx';
import ResetPasswordEmail from './templates/ResetPasswordEmail.jsx';
import MagicLinkEmail from './templates/MagicLinkEmail.jsx';

const templateRegistry = {
    notification: NotificationEmail,
    comment_notification: CommentNotificationEmail,
    verification: VerificationEmail,
    reset_password: ResetPasswordEmail,
    magic_link: MagicLinkEmail,
};

export default templateRegistry;

/**
 * Get a template component by name
 * @param {string} name - Template name
 * @returns {React.Component|null} Template component or null
 */
export function getTemplate(name) {
    return templateRegistry[name] || null;
}
