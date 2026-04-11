DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'ENHANCED'
          AND enumtypid = '"NotificationLevel"'::regtype
    ) THEN
        ALTER TYPE "NotificationLevel" ADD VALUE 'ENHANCED';
    END IF;
END $$;

UPDATE "ow_notification_settings"
SET "level" = 'BASIC'
WHERE "level" = 'DEFAULT';

ALTER TABLE "ow_notification_settings"
ALTER COLUMN "level" SET DEFAULT 'BASIC';
