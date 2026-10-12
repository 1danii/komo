CREATE TABLE thread_github_issues (
  thread_id TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  project TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  issue_number INTEGER,
  issue_url TEXT,
  created_by TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX thread_github_issues_project ON thread_github_issues(project);
