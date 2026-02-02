-- AlterTable
CREATE SEQUENCE oauth_applications_id_seq;
ALTER TABLE "oauth_applications" ALTER COLUMN "id" SET DEFAULT nextval('oauth_applications_id_seq');
ALTER SEQUENCE oauth_applications_id_seq OWNED BY "oauth_applications"."id";

-- AlterTable
CREATE SEQUENCE ow_account_tokens_id_seq;
ALTER TABLE "ow_account_tokens" ALTER COLUMN "id" SET DEFAULT nextval('ow_account_tokens_id_seq');
ALTER SEQUENCE ow_account_tokens_id_seq OWNED BY "ow_account_tokens"."id";

-- AlterTable
CREATE SEQUENCE ow_analytics_device_id_seq;
ALTER TABLE "ow_analytics_device" ALTER COLUMN "id" SET DEFAULT nextval('ow_analytics_device_id_seq');
ALTER SEQUENCE ow_analytics_device_id_seq OWNED BY "ow_analytics_device"."id";

-- AlterTable
CREATE SEQUENCE ow_analytics_event_id_seq;
ALTER TABLE "ow_analytics_event" ALTER COLUMN "id" SET DEFAULT nextval('ow_analytics_event_id_seq');
ALTER SEQUENCE ow_analytics_event_id_seq OWNED BY "ow_analytics_event"."id";

-- AlterTable
CREATE SEQUENCE ow_assets_id_seq;
ALTER TABLE "ow_assets" ALTER COLUMN "id" SET DEFAULT nextval('ow_assets_id_seq');
ALTER SEQUENCE ow_assets_id_seq OWNED BY "ow_assets"."id";

-- AlterTable
CREATE SEQUENCE ow_auth_tokens_id_seq;
ALTER TABLE "ow_auth_tokens" ALTER COLUMN "id" SET DEFAULT nextval('ow_auth_tokens_id_seq');
ALTER SEQUENCE ow_auth_tokens_id_seq OWNED BY "ow_auth_tokens"."id";

-- AlterTable
CREATE SEQUENCE ow_config_id_seq;
ALTER TABLE "ow_config" ALTER COLUMN "id" SET DEFAULT nextval('ow_config_id_seq');
ALTER SEQUENCE ow_config_id_seq OWNED BY "ow_config"."id";

-- AlterTable
CREATE SEQUENCE ow_oauth_access_tokens_id_seq;
ALTER TABLE "ow_oauth_access_tokens" ALTER COLUMN "id" SET DEFAULT nextval('ow_oauth_access_tokens_id_seq');
ALTER SEQUENCE ow_oauth_access_tokens_id_seq OWNED BY "ow_oauth_access_tokens"."id";

-- AlterTable
CREATE SEQUENCE ow_oauth_authorizations_id_seq;
ALTER TABLE "ow_oauth_authorizations" ALTER COLUMN "id" SET DEFAULT nextval('ow_oauth_authorizations_id_seq');
ALTER SEQUENCE ow_oauth_authorizations_id_seq OWNED BY "ow_oauth_authorizations"."id";

-- AlterTable
CREATE SEQUENCE ow_oauth_scopes_id_seq;
ALTER TABLE "ow_oauth_scopes" ALTER COLUMN "id" SET DEFAULT nextval('ow_oauth_scopes_id_seq');
ALTER SEQUENCE ow_oauth_scopes_id_seq OWNED BY "ow_oauth_scopes"."id";

-- AlterTable
CREATE SEQUENCE ow_projects_assets_id_seq;
ALTER TABLE "ow_projects_assets" ALTER COLUMN "id" SET DEFAULT nextval('ow_projects_assets_id_seq');
ALTER SEQUENCE ow_projects_assets_id_seq OWNED BY "ow_projects_assets"."id";

-- AlterTable
CREATE SEQUENCE ow_projects_branch_id_seq;
ALTER TABLE "ow_projects_branch" ALTER COLUMN "id" SET DEFAULT nextval('ow_projects_branch_id_seq');
ALTER SEQUENCE ow_projects_branch_id_seq OWNED BY "ow_projects_branch"."id";

-- AlterTable
CREATE SEQUENCE ow_projects_list_items_id_seq;
ALTER TABLE "ow_projects_list_items" ALTER COLUMN "id" SET DEFAULT nextval('ow_projects_list_items_id_seq');
ALTER SEQUENCE ow_projects_list_items_id_seq OWNED BY "ow_projects_list_items"."id";

-- AlterTable
CREATE SEQUENCE ow_projects_lists_id_seq;
ALTER TABLE "ow_projects_lists" ALTER COLUMN "id" SET DEFAULT nextval('ow_projects_lists_id_seq');
ALTER SEQUENCE ow_projects_lists_id_seq OWNED BY "ow_projects_lists"."id";

-- AlterTable
CREATE SEQUENCE ow_projects_stars_id_seq;
ALTER TABLE "ow_projects_stars" ALTER COLUMN "id" SET DEFAULT nextval('ow_projects_stars_id_seq');
ALTER SEQUENCE ow_projects_stars_id_seq OWNED BY "ow_projects_stars"."id";

-- AlterTable
CREATE SEQUENCE ow_projects_tags_id_seq;
ALTER TABLE "ow_projects_tags" ALTER COLUMN "id" SET DEFAULT nextval('ow_projects_tags_id_seq');
ALTER SEQUENCE ow_projects_tags_id_seq OWNED BY "ow_projects_tags"."id";

-- AlterTable
CREATE SEQUENCE ow_push_subscriptions_id_seq;
ALTER TABLE "ow_push_subscriptions" ALTER COLUMN "id" SET DEFAULT nextval('ow_push_subscriptions_id_seq');
ALTER SEQUENCE ow_push_subscriptions_id_seq OWNED BY "ow_push_subscriptions"."id";

-- AlterTable
CREATE SEQUENCE ow_scratch_extensions_id_seq;
ALTER TABLE "ow_scratch_extensions" ALTER COLUMN "id" SET DEFAULT nextval('ow_scratch_extensions_id_seq');
ALTER SEQUENCE ow_scratch_extensions_id_seq OWNED BY "ow_scratch_extensions"."id";

-- AlterTable
CREATE SEQUENCE ow_user_relationships_id_seq;
ALTER TABLE "ow_user_relationships" ALTER COLUMN "id" SET DEFAULT nextval('ow_user_relationships_id_seq');
ALTER SEQUENCE ow_user_relationships_id_seq OWNED BY "ow_user_relationships"."id";

-- AlterTable
CREATE SEQUENCE ow_users_id_seq;
ALTER TABLE "ow_users" ALTER COLUMN "id" SET DEFAULT nextval('ow_users_id_seq');
ALTER SEQUENCE ow_users_id_seq OWNED BY "ow_users"."id";

-- AlterTable
CREATE SEQUENCE ow_users_contacts_contact_id_seq;
ALTER TABLE "ow_users_contacts" ALTER COLUMN "contact_id" SET DEFAULT nextval('ow_users_contacts_contact_id_seq');
ALTER SEQUENCE ow_users_contacts_contact_id_seq OWNED BY "ow_users_contacts"."contact_id";

-- AlterTable
CREATE SEQUENCE ow_users_magiclink_id_seq;
ALTER TABLE "ow_users_magiclink" ALTER COLUMN "id" SET DEFAULT nextval('ow_users_magiclink_id_seq');
ALTER SEQUENCE ow_users_magiclink_id_seq OWNED BY "ow_users_magiclink"."id";

-- AlterTable
CREATE SEQUENCE ow_users_totp_id_seq;
ALTER TABLE "ow_users_totp" ALTER COLUMN "id" SET DEFAULT nextval('ow_users_totp_id_seq');
ALTER SEQUENCE ow_users_totp_id_seq OWNED BY "ow_users_totp"."id";
