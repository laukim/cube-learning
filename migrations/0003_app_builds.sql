-- One row per Workers deploy, so the footer can show v1.01, v1.02, … when the
-- build step did not bake a commit-count version into the worker.
CREATE TABLE IF NOT EXISTS app_builds (
  version_id TEXT PRIMARY KEY,
  n INTEGER NOT NULL UNIQUE
);
