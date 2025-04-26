/**
 * @fileoverview Event type definitions and data structure interfaces
 */
import { z } from 'zod';

/**
 * Base event data schema that all event types must implement
 */
export const BaseEventSchema = z.object({
  // Common fields required for all event types
  event_type: z.string(),
  actor_id: z.number(),
  target_type: z.string(),
  target_id: z.number(),
  // Additional metadata field that can be customized per event type
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Project commit event schema
 */
export const ProjectCommitEventSchema = BaseEventSchema.extend({
  commit_id: z.string(),
  commit_message: z.string(),
  branch: z.string(),
  commit_file: z.string(),
  project_name: z.string(),
  project_title: z.string(),
  project_type: z.string(),
  project_description: z.string().optional(),
  project_state: z.string(),
});

/**
 * Project update event schema
 */
export const ProjectUpdateEventSchema = BaseEventSchema.extend({
  update_type: z.string(),
  old_value: z.string().optional(),
  new_value: z.string().optional(),
});

/**
 * Project fork event schema
 */
export const ProjectForkEventSchema = BaseEventSchema.extend({
  fork_id: z.number(),
  project_name: z.string(),
  project_title: z.string(),
});

/**
 * Project create event schema
 */
export const ProjectCreateEventSchema = BaseEventSchema.extend({
  project_type: z.string(),
  project_name: z.string(),
  project_title: z.string(),
  project_description: z.string().optional(),
  project_state: z.string(),
});

/**
 * Project publish event schema
 */
export const ProjectPublishEventSchema = BaseEventSchema.extend({
  old_state: z.string(),
  new_state: z.string(),
  project_title: z.string(),
});

/**
 * Comment create event schema
 */
export const CommentCreateEventSchema = BaseEventSchema.extend({
  page_type: z.string(),
  page_id: z.number(),
  pid: z.number().optional(),
  rid: z.number().optional(),
  text: z.string().max(100), // Limit comment text to 100 chars
});

/**
 * User profile update event schema
 */
export const UserProfileUpdateEventSchema = BaseEventSchema.extend({
  update_type: z.string(),
  old_value: z.string().optional(),
  new_value: z.string().optional(),
});

/**
 * User login event schema
 */
export const UserLoginEventSchema = BaseEventSchema.extend({
  // No additional fields required
});

/**
 * User register event schema
 */
export const UserRegisterEventSchema = BaseEventSchema.extend({
  username: z.string(),
});

/**
 * Project rename event schema
 */
export const ProjectRenameEventSchema = BaseEventSchema.extend({
  old_name: z.string(),
  new_name: z.string(),
  project_title: z.string(),
  project_type: z.string(),
  project_state: z.string(),
});

/**
 * Project info update event schema
 */
export const ProjectInfoUpdateEventSchema = BaseEventSchema.extend({
  updated_fields: z.array(z.string()),
  old_values: z.record(z.string(), z.any()),
  new_values: z.record(z.string(), z.any()),
  project_name: z.string(),
  project_title: z.string(),
  project_type: z.string(),
  project_description: z.string().optional(),
  project_state: z.string(),
});

/**
 * Event configuration for system events
 */
export const EventConfig = {
  'project_commit': {
    schema: ProjectCommitEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['project_owner', 'project_followers'],
  },

  'project_update': {
    schema: ProjectUpdateEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['project_owner'],
  },

  'project_fork': {
    schema: ProjectForkEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['project_owner'],
  },

  'project_create': {
    schema: ProjectCreateEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['user_followers'],
  },

  'project_publish': {
    schema: ProjectPublishEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['user_followers'],
  },

  'comment_create': {
    schema: CommentCreateEventSchema,
    logToDatabase: false,
    public: false,
    notifyTargets: ['page_owner', 'thread_participants'],
  },

  'user_profile_update': {
    schema: UserProfileUpdateEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['user_followers'],
  },

  'user_login': {
    schema: UserLoginEventSchema,
    logToDatabase: false,
    public: false,
    notifyTargets: [],
  },

  'user_register': {
    schema: UserRegisterEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: [],
  },

  'project_rename': {
    schema: ProjectRenameEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['project_followers'],
  },

  'project_info_update': {
    schema: ProjectInfoUpdateEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['project_followers'],
  },
};

/**
 * Target types enum for event targets
 */
export const TargetTypes = {
  PROJECT: 'project',
  USER: 'user',
  COMMENT: 'comment',
};