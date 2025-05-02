# Database Migrations

This directory contains database migration files for the ZeroCat backend.

## Migration: Rename User State to Status

### Description
This migration renames the `state` field to `status` in the `ow_users` table to better align with code usage. It also adds documentation for the status values.

### Status Codes
- `0` = Pending (newly registered account)
- `1` = Active (normal active account)
- `2` = Suspended (temporarily disabled)
- `3` = Banned (permanently disabled)

### How to Run
To apply this migration, run:
```bash
node prisma/migrate-user-status.js
```

Or manually:
```bash
npx prisma migrate dev --name rename_user_state_to_status
```

### Related Files
- `prisma/migrations/20240715_rename_user_state_to_status/migration.sql` - SQL migration file
- `utils/userStatus.js` - Utility module for working with user status codes
- `src/middleware/auth.middleware.js` - Updated to use the new utility module

## Migration: Convert User Status to Enum Type

### Description
This migration converts the user `status` field from a numeric integer to a string enum type, making the code more readable and maintainable.

### Status Values
- `pending` = 待激活 (新注册账户)
- `active` = 正常 (正常活跃账户)
- `suspended` = 已暂停 (临时禁用账户)
- `banned` = 已封禁 (永久禁用账户)

### How to Run
To apply this migration, run:
```bash
node prisma/migrate-user-status.js
```

Or manually:
```bash
npx prisma migrate dev --name convert_user_status_to_enum
```

### Related Files
- `prisma/migrations/20240716_convert_user_status_to_enum/migration.sql` - SQL migration file
- `utils/userStatus.js` - Updated utility module for working with string status values
- `prisma/schema.prisma` - Added `user_status_type` enum

## Additional Migrations

Other migrations can be documented here as they are added.