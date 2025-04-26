# Event System Migration Guide

## Overview

This document provides guidance for migrating from the old event system to the new schema-based event system. The new system uses Zod for schema validation and provides a more structured approach to event handling.

## Migration Steps

### 1. Install Dependencies

The new event system requires the Zod library. Make sure it's installed:

```bash
npm install zod
# or
pnpm add zod
```

### 2. Run Database Migrations

Apply the database migration to add necessary indices:

```bash
npx prisma migrate dev --name enhance_event_model
```

This will create the following indices:
- `idx_events_actor_id`: For faster queries by actor
- `idx_events_type_target`: For faster queries by event type and target
- `idx_events_public`: For faster filtering of public/private events

### 3. Update Event Creation Code

If you're currently using the old event API:

```javascript
// Old approach
import { createEvent } from '../controllers/events.js';

await createEvent(
  'project_create',
  userId,
  'project',
  projectId,
  {
    project_type: 'scratch',
    // other fields...
  }
);
```

You can continue using this API as it's backwards compatible. The controller will transform your event data internally to match the new schema requirements.

### 4. Update Event Retrieval Code

For retrieving events, use the new methods:

```javascript
// Get events for a target
import { getTargetEvents, TargetTypes } from '../controllers/events.js';

const events = await getTargetEvents(
  TargetTypes.PROJECT,  // target type
  projectId,           // target ID
  10,                  // limit
  0,                   // offset
  false                // include private events?
);

// Get events for an actor
import { getActorEvents } from '../controllers/events.js';

const events = await getActorEvents(
  userId,   // actor ID
  10,       // limit
  0,        // offset
  false     // include private events?
);
```

### 5. Add New Event Types

If you need to add a new event type:

1. Define the schema in `models/events.js`:

```javascript
export const MyNewEventSchema = BaseEventSchema.extend({
  // Add your event-specific fields here
  field1: z.string(),
  field2: z.number(),
  // etc.
});
```

2. Add the event configuration to `EventConfig` in the same file:

```javascript
export const EventConfig = {
  // ... existing event configs ...

  'my_new_event': {
    schema: MyNewEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['appropriate_targets'],
  },
};
```

## Troubleshooting

### Schema Validation Errors

If you get validation errors, check the event data against the schema defined in `models/events.js`. The logs will contain detailed error information.

### Migration Issues

If you encounter issues during migration, try:

1. Make sure there are no conflicting migration files
2. Check that the database user has sufficient privileges to create indices
3. Verify the database connection configuration

## Additional Resources

For more detailed information, refer to:
- [Event System Documentation](./events-system.md)
- [Zod Documentation](https://github.com/colinhacks/zod)