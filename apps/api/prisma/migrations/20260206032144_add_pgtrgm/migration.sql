-- Enable pg_trgm for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Remove deprecated columns from projects
ALTER TABLE ow_projects DROP COLUMN IF EXISTS tags;
ALTER TABLE ow_projects DROP COLUMN IF EXISTS devenv;

-- Projects: name/title/description
CREATE INDEX IF NOT EXISTS idx_ow_projects_name_trgm
  ON ow_projects USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ow_projects_title_trgm
  ON ow_projects USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ow_projects_description_trgm
  ON ow_projects USING gin (description gin_trgm_ops);

-- Posts: content
CREATE INDEX IF NOT EXISTS idx_ow_posts_content_trgm
  ON ow_posts USING gin (content gin_trgm_ops);

-- Project files: source (trgm), creator, create_time
CREATE INDEX IF NOT EXISTS idx_ow_projects_file_source_tsv_simple
  ON ow_projects_file
  USING gin (to_tsvector('simple', left(COALESCE(source, ''), 200000)));
CREATE INDEX IF NOT EXISTS idx_ow_projects_file_create_userid
  ON ow_projects_file (create_userid);
CREATE INDEX IF NOT EXISTS idx_ow_projects_file_create_time
  ON ow_projects_file (create_time);

-- Users: username/display_name/bio/motto/location/region
CREATE INDEX IF NOT EXISTS idx_ow_users_username_trgm
  ON ow_users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ow_users_display_name_trgm
  ON ow_users USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ow_users_bio_trgm
  ON ow_users USING gin (bio gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ow_users_motto_trgm
  ON ow_users USING gin (motto gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ow_users_location_trgm
  ON ow_users USING gin (location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ow_users_region_trgm
  ON ow_users USING gin (region gin_trgm_ops);
