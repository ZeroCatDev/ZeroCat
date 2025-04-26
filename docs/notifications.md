# Notification System Documentation

## Overview

The ZeroCat notification system allows for sending various types of notifications to users. Notifications are stored in the database and can be retrieved via API endpoints. Each notification type has a specific format and can include redirect information for navigating to related content.

## Notification Redirect System

### New Redirect Format

Notifications now include a `redirect_info` object that provides structured information for frontend routing. This replaces the previous string-based URL format, giving more flexibility for frontend frameworks to handle routing.

The `redirect_info` object can have the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | The type of redirect (e.g., 'project', 'user', 'comment', 'topic', or 'url') |
| `id` | number | The ID of the target resource |
| `subId` | number | Optional: A secondary ID (e.g., comment ID within a project) |
| `altType` | string | Optional: An alternative redirect type |
| `altId` | number | Optional: An alternative resource ID |
| `url` | string | Optional: For custom redirects with a full URL |

### Examples

#### Project Notification

```json
{
  "redirect_info": {
    "type": "project",
    "id": 123,
    "subId": 456  // Optional: e.g., a comment ID within the project
  }
}
```

#### Dynamic Context Notification

```json
{
  "redirect_info": {
    "type": "project",
    "id": 789
  }
}
```

#### Custom URL Notification

```json
{
  "redirect_info": {
    "type": "url",
    "url": "https://zerocat.org/special-page"
  }
}
```

### Legacy Format

For backward compatibility, notifications still include a `redirect_url` string property. However, new frontend implementations should use the `redirect_info` object for more flexible routing.

## Using the Notification Redirects in Frontend Code

### React Router Example

```jsx
function handleNotificationClick(notification) {
  const redirectInfo = notification.redirect_info;

  if (!redirectInfo) return;

  if (redirectInfo.type === 'url') {
    // Handle external URL
    window.location.href = redirectInfo.url;
    return;
  }

  // Handle internal routing based on type
  let path = `/${redirectInfo.type}/${redirectInfo.id}`;

  // Add fragment for subId if present
  if (redirectInfo.subId) {
    path += `#${redirectInfo.subId}`;
  }

  // Use your router's navigation method
  navigate(path);
}
```

### Vue Router Example

```javascript
function handleNotificationClick(notification) {
  const redirectInfo = notification.redirect_info;

  if (!redirectInfo) return;

  if (redirectInfo.type === 'url') {
    // Handle external URL
    window.location.href = redirectInfo.url;
    return;
  }

  // Handle internal routing based on type
  const routeOptions = {
    path: `/${redirectInfo.type}/${redirectInfo.id}`
  };

  // Add hash for subId if present
  if (redirectInfo.subId) {
    routeOptions.hash = `#${redirectInfo.subId}`;
  }

  // Use Vue Router
  router.push(routeOptions);
}
```

## Testing Notifications

You can test all notification types with the test endpoint:

```
POST /api/notifications/test
```

This endpoint requires authentication and will create one of each notification type for the current user. This is useful for testing how notifications appear in the UI and how redirects work.

## Further Information

For more information on notification types and their specific data formats, see the notification type definitions in `src/config/constants/notifications.js`.