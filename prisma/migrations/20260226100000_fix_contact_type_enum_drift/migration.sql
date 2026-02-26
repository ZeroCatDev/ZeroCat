-- 1) 如果 contact_type 里有 NULL，先填一个默认值（否则后面若列是 NOT NULL 会失败）
UPDATE "ow_users_contacts"
SET "contact_type" = 'email'
WHERE "contact_type" IS NULL;

-- 2) 把 enum 列改成 VARCHAR(50)，显式转换 USING
ALTER TABLE "ow_users_contacts"
  ALTER COLUMN "contact_type"
  TYPE VARCHAR(50)
  USING ("contact_type"::text);


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_type t ON a.atttypid = t.oid
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.typname = 'ow_users_contacts_contact_type'
      AND n.nspname = 'public'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    DROP TYPE IF EXISTS "ow_users_contacts_contact_type";
  END IF;
END $$;