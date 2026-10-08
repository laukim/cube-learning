-- Timestamped smart-cube move log for a solve. Nullable so existing rows stay valid.
ALTER TABLE solves ADD COLUMN moves_json TEXT;
