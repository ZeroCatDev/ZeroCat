DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'BASIC'
          AND enumtypid = '"NotificationLevel"'::regtype
    ) THEN
        ALTER TYPE "NotificationLevel" ADD VALUE 'BASIC';
    END IF;
END $$;

UPDATE "ow_notification_settings"
SET "level" = 'NONE'
WHERE "level" = 'DEFAULT';

ALTER TABLE "ow_notification_settings"
ALTER COLUMN "level" SET DEFAULT 'NONE';
