-- AlterTable: Update events table structure
-- We keep the existing structure but modify how we use the event_data field

-- Add index on actor_id for better performance on actor-based queries
DROP INDEX IF EXISTS `idx_events_actor_id` ON `events`;
CREATE INDEX `idx_events_actor_id` ON `events` (`actor_id`);

-- Add combined index for event_type and target_id to optimize common queries
DROP INDEX IF EXISTS `idx_events_type_target` ON `events`;
CREATE INDEX `idx_events_type_target` ON `events` (`event_type`, `target_id`);

-- Add index on public field for filtering public/private events efficiently
DROP INDEX IF EXISTS `idx_events_public` ON `events`;
CREATE INDEX `idx_events_public` ON `events` (`public`);