/**
 * Notification type definitions
 * Each notification type has settings that determine its behavior and display
 */
export const NotificationTypes = {
  // PROJECT NOTIFICATIONS (1-19)
  // When someone comments on a project
  PROJECT_COMMENT: {
    id: 1,
    icon: 'comment',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'project',
    redirectIdField: 'project_id',
    subRedirectIdField: 'comment_id',
    template: {
      title: '{{actor_name}} commented on your project {{project_title}}',
      body: '{{comment_text}}'
    }
  },
  // When someone stars a project
  PROJECT_STAR: {
    id: 2,
    icon: 'star',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'project',
    redirectIdField: 'project_id',
    template: {
      title: '{{actor_name}} starred your project {{project_title}}',
      body: 'Your project now has {{star_count}} stars'
    }
  },
  // When someone forks a project
  PROJECT_FORK: {
    id: 3,
    icon: 'fork',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'project',
    redirectIdField: 'project_id',
    altRedirectType: 'project',
    altRedirectIdField: 'fork_id',
    template: {
      title: '{{actor_name}} forked your project {{project_title}}',
      body: 'Your project now has {{fork_count}} forks'
    }
  },
  // When someone mentions a user in a project
  PROJECT_MENTION: {
    id: 4,
    icon: 'mention',
    priority: 'high',
    requiresAuth: true,
    redirectType: 'project',
    redirectIdField: 'project_id',
    template: {
      title: '{{actor_name}} mentioned you in project {{project_title}}',
      body: '{{mention_text}}'
    }
  },
  // When a project is updated
  PROJECT_UPDATE: {
    id: 5,
    icon: 'update',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'project',
    redirectIdField: 'project_id',
    template: {
      title: '{{actor_name}} updated project {{project_title}}',
      body: 'Changes: {{update_details}}'
    }
  },
  // When a user is invited to collaborate on a project
  PROJECT_COLLABORATION_INVITE: {
    id: 6,
    icon: 'invite',
    priority: 'high',
    requiresAuth: true,
    redirectType: 'project',
    redirectIdField: 'project_id',
    template: {
      title: '{{actor_name}} invited you to collaborate on {{project_title}}',
      body: 'Click to view the invitation'
    }
  },
  // When a user accepts a collaboration invite
  PROJECT_COLLABORATION_ACCEPT: {
    id: 7,
    icon: 'accept',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'project',
    redirectIdField: 'project_id',
    template: {
      title: '{{actor_name}} accepted your invitation to collaborate on {{project_title}}',
      body: 'You now have a new collaborator'
    }
  },
  // When someone likes a project
  PROJECT_LIKE: {
    id: 8,
    icon: 'heart',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'project',
    redirectIdField: 'project_id',
    template: {
      title: '{{actor_name}} liked your project {{project_title}}',
      body: 'Your project now has {{like_count}} likes'
    }
  },
  // When someone adds project to a collection
  PROJECT_COLLECT: {
    id: 9,
    icon: 'folder',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'project',
    redirectIdField: 'project_id',
    altRedirectType: 'collection',
    altRedirectIdField: 'collection_id',
    template: {
      title: '{{actor_name}} added your project to collection {{collection_name}}',
      body: 'Your project {{project_title}} was collected'
    }
  },

  // USER NOTIFICATIONS (20-49)
  // When someone follows a user
  USER_FOLLOW: {
    id: 20,
    icon: 'follow',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'user',
    redirectIdField: 'actor_id',
    template: {
      title: '{{actor_name}} is now following you',
      body: 'You now have {{follower_count}} followers'
    }
  },
  // When someone mentions a user
  USER_MENTION: {
    id: 21,
    icon: 'mention',
    priority: 'high',
    requiresAuth: true,
    redirectType: 'dynamic', // Redirects based on context_type and context_id
    redirectTypeField: 'context_type',
    redirectIdField: 'context_id',
    template: {
      title: '{{actor_name}} mentioned you',
      body: '{{mention_text}}'
    }
  },
  // When someone likes a user's content
  USER_LIKE: {
    id: 25,
    icon: 'heart',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'dynamic', // Redirects based on content_type and content_id
    redirectTypeField: 'content_type',
    redirectIdField: 'content_id',
    template: {
      title: '{{actor_name}} liked your {{content_type_display}}',
      body: '{{content_excerpt}}'
    }
  },
  // New comment notification
  USER_NEW_COMMENT: {
    id: 26,
    icon: 'comment',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'comment',
    redirectIdField: 'comment_id',
    template: {
      title: 'New comment from {{actor_name}}',
      body: '{{comment_text}}'
    }
  },

  // SYSTEM NOTIFICATIONS (50-99)
  // System-wide announcements
  SYSTEM_ANNOUNCEMENT: {
    id: 50,
    icon: 'announcement',
    priority: 'high',
    requiresAuth: false,
    redirectType: 'announcement',
    redirectIdField: 'announcement_id',
    template: {
      title: 'System Announcement',
      body: '{{announcement_text}}'
    }
  },
  // System maintenance notifications
  SYSTEM_MAINTENANCE: {
    id: 51,
    icon: 'maintenance',
    priority: 'high',
    requiresAuth: false,
    redirectType: 'system',
    redirectIdField: null, // No specific page
    template: {
      title: 'System Maintenance',
      body: '{{maintenance_text}}'
    }
  },

  // COMMENT NOTIFICATIONS (100-199)
  // When someone replies to a comment
  COMMENT_REPLY: {
    id: 100,
    icon: 'reply',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'comment',
    redirectIdField: 'reply_id',
    parentRedirectType: 'dynamic',
    parentRedirectTypeField: 'context_type',
    parentRedirectIdField: 'context_id',
    template: {
      title: '{{actor_name}} replied to your comment',
      body: '{{reply_text}}'
    }
  },
  // When someone likes a comment
  COMMENT_LIKE: {
    id: 101,
    icon: 'heart',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'comment',
    redirectIdField: 'comment_id',
    template: {
      title: '{{actor_name}} liked your comment',
      body: '{{comment_excerpt}}'
    }
  },
  // When someone mentions a user in a comment
  COMMENT_MENTION: {
    id: 102,
    icon: 'mention',
    priority: 'high',
    requiresAuth: true,
    redirectType: 'comment',
    redirectIdField: 'comment_id',
    template: {
      title: '{{actor_name}} mentioned you in a comment',
      body: '{{mention_text}}'
    }
  },

  // CUSTOM NOTIFICATIONS (800+)
  // Generic custom notification
  CUSTOM_NOTIFICATION: {
    id: 800,
    icon: 'notification',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'custom',
    redirectUrlField: 'redirect_url',
    template: {
      title: '{{title}}',
      body: '{{body}}'
    }
  },
  // Custom topic reply notification
  CUSTOM_TOPIC_REPLY: {
    id: 801,
    icon: 'reply',
    priority: 'normal',
    requiresAuth: true,
    redirectType: 'topic',
    redirectIdField: 'topic_id',
    subRedirectIdField: 'post_number',
    template: {
      title: 'New reply in "{{topic_title}}"',
      body: '{{reply_preview}}'
    }
  },
  // Custom topic mention notification
  CUSTOM_TOPIC_MENTION: {
    id: 802,
    icon: 'mention',
    priority: 'high',
    requiresAuth: true,
    redirectType: 'topic',
    redirectIdField: 'topic_id',
    subRedirectIdField: 'post_number',
    template: {
      title: 'You were mentioned in "{{topic_title}}"',
      body: '{{mention_text}}'
    }
  }
};

// Map notification type IDs to their details for quick lookup
export const NotificationTypesById = Object.values(NotificationTypes).reduce((acc, type) => {
  acc[type.id] = type;
  return acc;
}, {});

/**
 * Get redirect URL for a notification
 *
 * @param {Object} notification - The notification object
 * @returns {Object|null} The redirect information or null if not available
 */
export function getNotificationRedirectInfo(notification) {
  if (!notification || !notification.data) return null;

  const typeConfig = NotificationTypesById[notification.notification_type];
  if (!typeConfig) return null;

  const data = notification.data;
  const redirectInfo = {};

  // Custom redirect URL
  if (typeConfig.redirectType === 'custom' && typeConfig.redirectUrlField && data[typeConfig.redirectUrlField]) {
    redirectInfo.type = 'url';
    redirectInfo.url = data[typeConfig.redirectUrlField];
    return redirectInfo;
  }

  // Dynamic redirect based on context
  if (typeConfig.redirectType === 'dynamic' && typeConfig.redirectTypeField && typeConfig.redirectIdField) {
    const redirectType = data[typeConfig.redirectTypeField];
    const redirectId = data[typeConfig.redirectIdField];
    if (redirectType && redirectId) {
      redirectInfo.type = redirectType;
      redirectInfo.id = redirectId;
      return redirectInfo;
    }
    return null;
  }

  // Standard redirect with type and ID
  if (typeConfig.redirectType && typeConfig.redirectIdField && data[typeConfig.redirectIdField]) {
    redirectInfo.type = typeConfig.redirectType;
    redirectInfo.id = data[typeConfig.redirectIdField];

    // Add sub-redirect if available (like comment ID or post number)
    if (typeConfig.subRedirectIdField && data[typeConfig.subRedirectIdField]) {
      redirectInfo.subId = data[typeConfig.subRedirectIdField];
    }

    // Add alternate redirect if available
    if (typeConfig.altRedirectType && typeConfig.altRedirectIdField && data[typeConfig.altRedirectIdField]) {
      redirectInfo.altType = typeConfig.altRedirectType;
      redirectInfo.altId = data[typeConfig.altRedirectIdField];
    }

    return redirectInfo;
  }

  return null;
}

/**
 * Get redirect URL for a notification (legacy format for backward compatibility)
 *
 * @param {Object} notification - The notification object
 * @returns {string|null} The redirect URL or null if not available
 */
export function getNotificationRedirectUrl(notification) {
  const redirectInfo = getNotificationRedirectInfo(notification);
  if (!redirectInfo) return null;

  // Custom URL
  if (redirectInfo.type === 'url') {
    return redirectInfo.url;
  }

  // Construct URL from type and ID
  const baseUrl = `/${redirectInfo.type}/${redirectInfo.id}`;

  // Add fragment for sub-ID if present
  if (redirectInfo.subId) {
    return `${baseUrl}#${redirectInfo.subId}`;
  }

  return baseUrl;
}

export default {
  NotificationTypes,
  NotificationTypesById,
  getNotificationRedirectInfo,
  getNotificationRedirectUrl
};