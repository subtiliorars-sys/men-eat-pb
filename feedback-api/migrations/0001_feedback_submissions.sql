CREATE TABLE IF NOT EXISTS feedback_submissions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'needs_info')),
  category TEXT NOT NULL CHECK (category IN ('bug', 'balance', 'feel', 'accessibility', 'other')),
  message TEXT NOT NULL,
  contact TEXT,
  allow_public_review INTEGER NOT NULL DEFAULT 1,
  run_summary_json TEXT NOT NULL,
  page_url TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  schema_version INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  reviewer TEXT,
  review_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created_at
  ON feedback_submissions (status, created_at DESC);
