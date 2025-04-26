# Event System Documentation

## Overview

The event system allows the application to track and respond to various activities within the platform. It was restructured to use schema validation and standardize event data formats.

## Key Features

- **Schema Validation**: All events are validated against predefined schemas
- **Standardized Event Format**: Consistent event data structure across the application
- **Notification Support**: Automatic notification of relevant users based on event type
- **Privacy Controls**: Events can be marked as public or private

## Using the Event System

### Event Types

Each event type is defined in `models/events.js` with its own schema. The available event types are:

- `project_commit`: When a user commits changes to a project
- `project_update`: When a project is updated
- `project_fork`: When a project is forked
- `project_create`: When a new project is created
- `project_publish`: When a project is published
- `comment_create`: When a user creates a comment
- `user_profile_update`: When a user updates their profile
- `user_login`: When a user logs in
- `user_register`: When a user registers
- `project_rename`: When a project is renamed
- `project_info_update`: When project information is updated

### Creating Events

To create an event, use the `createEvent` function from the events controller:

```javascript
import { createEvent, TargetTypes } from '../controllers/events.js';

// Example: Create a project_create event
await createEvent(
  'project_create',  // event type
  userId,           // actor ID
  TargetTypes.PROJECT, // target type
  projectId,        // target ID
  {
    project_type: 'scratch',
    project_name: 'my-project',
    project_title: 'My Project',
    project_description: 'Description of my project',
    project_state: 'private'
  }
);
```

The event data will be validated against the schema defined for the event type.

### Retrieving Events

To get events for a specific target:

```javascript
import { getTargetEvents, TargetTypes } from '../controllers/events.js';

// Get events for a project
const events = await getTargetEvents(
  TargetTypes.PROJECT,  // target type
  projectId,           // target ID
  10,                  // limit
  0,                   // offset
  false                // include private events?
);
```

To get events for a specific actor:

```javascript
import { getActorEvents } from '../controllers/events.js';

// Get events for a user
const events = await getActorEvents(
  userId,   // actor ID
  10,       // limit
  0,        // offset
  false     // include private events?
);
```

## Internal Architecture

### Schema-Based Validation

All event data is validated using Zod schemas defined in `models/events.js`. This ensures that event data is consistent and contains all required fields.

### Event Processing Flow

1. Controller receives event creation request
2. Data is validated against the schema
3. Event is stored in the database
4. Notifications are sent to relevant users

### Database Structure

Events are stored in the `events` table with the following structure:

- `id`: Unique identifier for the event
- `event_type`: Type of event
- `actor_id`: ID of the user who performed the action
- `target_type`: Type of the target object (project, user, etc.)
- `target_id`: ID of the target object
- `event_data`: JSON data specific to the event type
- `created_at`: Timestamp when the event was created
- `public`: Whether the event is publicly visible

## Migration Notes

The migration script `20240705000000_enhance_event_model` adds the following indices to improve query performance:

- `idx_events_actor_id`: Index on actor_id
- `idx_events_type_target`: Combined index on event_type and target_id
- `idx_events_public`: Index on public field