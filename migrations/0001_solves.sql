-- One row per solve, keyed to the verified Google subject.
-- solved_at is the datetime the solve happened (epoch milliseconds), not the insert time.
CREATE TABLE IF NOT EXISTS solves (
  user_sub TEXT NOT NULL,
  id TEXT NOT NULL,
  ms INTEGER NOT NULL,
  solved_at INTEGER NOT NULL,
  scramble TEXT NOT NULL DEFAULT '',
  splits_json TEXT,
  PRIMARY KEY (user_sub, id)
);

CREATE INDEX IF NOT EXISTS solves_by_time ON solves (user_sub, solved_at, id);
