# User Relationships System

## Overview

The ZeroCat User Relationships system provides a flexible way to manage different types of relationships between users, such as follows, blocks, mutes, and favorites. This system replaces the previous follows-specific implementation with a more generalized approach that can handle multiple relationship types.

## Database Schema

The system uses a `user_relationships` table with the following structure:

| Field              | Type                     | Description                                     |
|--------------------|--------------------------|-------------------------------------------------|
| `id`               | Int (auto-increment)     | Primary key                                     |
| `source_user_id`   | Int                      | The user initiating the relationship            |
| `target_user_id`   | Int                      | The user receiving the relationship             |
| `relationship_type`| Enum                     | Type of relationship (follow, block, mute, etc.)|
| `created_at`       | DateTime                 | When the relationship was created               |
| `updated_at`       | DateTime                 | When the relationship was last updated          |
| `metadata`         | Json                     | Additional data for the relationship            |

The table has a unique constraint on `(source_user_id, target_user_id, relationship_type)` to ensure that a user can only have one relationship of each type with another user.

## Relationship Types

The current supported relationship types are:

- `follow`: User follows another user to see their content in feeds
- `block`: User blocks another user to prevent interactions
- `mute`: User mutes another user to hide their content but still allow interactions
- `favorite`: User marks another user as a favorite

Additional relationship types can be added to the enum as needed.

## API Endpoints

### Follow Management

- `POST /api/follows/:userId` - Follow a user
- `DELETE /api/follows/:userId` - Unfollow a user
- `GET /api/follows/followers/:userId` - Get followers of a user
- `GET /api/follows/following/:userId` - Get users followed by a user
- `GET /api/follows/check/:userId` - Check if logged in user is following a user

### Block Management

- `POST /api/follows/block/:userId` - Block a user
- `DELETE /api/follows/block/:userId` - Unblock a user
- `GET /api/follows/blocked` - Get users blocked by the logged in user
- `GET /api/follows/check-block/:userId` - Check if logged in user has blocked a user

### General Relationship Management

- `GET /api/follows/relationships/:userId` - Get all relationships between logged in user and another user

## Usage Examples

### Following a User

```javascript
// Client-side
const response = await fetch(`/api/follows/${userId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
```

### Blocking a User

```javascript
// Client-side
const response = await fetch(`/api/follows/block/${userId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
```

### Checking Relationships

```javascript
// Client-side
const response = await fetch(`/api/follows/relationships/${userId}`);
const result = await response.json();

// Example result
{
  "success": true,
  "data": {
    "isFollowing": true,
    "isFollowedBy": false,
    "isBlocking": false,
    "isBlockedBy": false,
    "isMuting": false,
    "hasFavorited": true,
    "relationships": {
      "outgoing": [...],
      "incoming": [...]
    }
  }
}
```

## Implementing Custom Relationship Types

To add a new relationship type:

1. Add the new type to the `user_relationship_type` enum in `prisma/schema.prisma`
2. Add controller methods for the new relationship type in `controllers/follows.js`
3. Add route handlers for the new relationship type in `routes/follows.js`

## Data Migration

When deploying this system to replace the previous follows system, run the migration script to transfer existing data:

```
node migrations/migrate-follows-to-relationships.js
```

This script will transfer all follows from the old `user_follows` table to the new `user_relationships` table with the relationship type set to `follow`.

## Code Example: Adding a New Relationship Type

1. First, add the new type to the enum in the Prisma schema:

```prisma
enum user_relationship_type {
  follow
  block
  mute
  favorite
  super_follow // New type
}
```

2. Add controller methods:

```javascript
// Add to controllers/follows.js
export async function superFollowUser(followerId, followedId) {
  try {
    // Implementation
    const relationship = await prisma.ow_user_relationships.create({
      data: {
        source_user_id: followerId,
        target_user_id: followedId,
        relationship_type: 'super_follow',
        metadata: { /* additional data */ }
      }
    });

    return relationship;
  } catch (error) {
    logger.error("Error in superFollowUser:", error);
    throw error;
  }
}
```

3. Add route handlers:

```javascript
// Add to routes/follows.js
router.post('/super/:userId', needLogin, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followedId = parseInt(req.params.userId);

    const result = await followsController.superFollowUser(followerId, followedId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});
```