CREATE TABLE github_connect_states (
  state_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project TEXT NOT NULL,
  session_project TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  origin TEXT NOT NULL,
  verifier TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX github_connect_states_expiry ON github_connect_states(expires_at);
CREATE TABLE project_github (
  project TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  login TEXT NOT NULL,
  installations TEXT NOT NULL,
  installation_id TEXT,
  repository_id TEXT,
  repository_name TEXT
);
