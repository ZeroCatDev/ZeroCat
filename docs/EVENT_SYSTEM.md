# Event System Documentation

## Overview

The ZeroCat event system has been refactored to use a centralized JSON configuration for all event-related data. This makes the code more maintainable and easier to understand.

## Key Components

### 1. Configuration (`config/eventConfig.json`)

This JSON file contains all event-related configuration in one place:

- `targetTypes`: Defines the types of entities that can be targets of events (PROJECT, USER, COMMENT)
- `eventTypes`: Constants for all supported event types
- `eventConfig`: Configuration for each event type, including:
  - `public`: Whether the event is visible to all users
  - `notifyTargets`: Which users should be notified when this event occurs

### 2. Controller (`controllers/events.js`)

The event controller imports the configuration and provides:

- Event creation functionality
- Event retrieval
- Notification processing
- Helper functions

### 3. Routes (`src/routes/event.routes.js`)

The routes file defines the API endpoints for:

- Getting events for a specific target
- Getting events for a specific actor
- Creating new events
- Retrieving follower information

## How to Add a New Event Type

1. Add the new event type to `eventTypes` in `config/eventConfig.json`
2. Add configuration for the event in the `eventConfig` section, specifying:
   - `public`: Boolean indicating visibility
   - `notifyTargets`: Array of user roles to notify

## Notification Targets

The following notification targets are supported:

- `project_owner`: The owner of the project
- `project_followers`: Users following the project
- `user_followers`: Users following the actor
- `page_owner`: The owner of a page where an action occurred
- `thread_participants`: Users who have commented in a thread