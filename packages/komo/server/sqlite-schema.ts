import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Existing SQL migrations own constraints, indexes, and triggers.
// These declarations map stored columns for native Drizzle queries.

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  verified: integer("verified").notNull().default(0),
  avatar_url: text("avatar_url"),
  accent_color: text("accent_color"),
  email: text("email"),
});

export const sessions = sqliteTable("sessions", {
  token_hash: text("token_hash").primaryKey(),
  user_id: text("user_id").notNull(),
  project: text("project").notNull(),
  expires_at: integer("expires_at").notNull(),
});

export const threads = sqliteTable("threads", {
  id: text("id").primaryKey(),
  project: text("project").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  page: text("page").notNull(),
  anchor: text("anchor").notNull(),
  resolved: integer("resolved").notNull().default(0),
  resolved_by: text("resolved_by"),
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
});

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  thread_id: text("thread_id").notNull(),
  user_id: text("user_id").notNull(),
  body: text("body").notNull(),
  created_at: integer("created_at").notNull(),
  edited_at: integer("edited_at"),
});

export const reactions = sqliteTable("reactions", {
  comment_id: text("comment_id").notNull(),
  user_id: text("user_id").notNull(),
  emoji: text("emoji").notNull(),
});

export const oauth_states = sqliteTable("oauth_states", {
  state_hash: text("state_hash").primaryKey(),
  verifier: text("verifier").notNull(),
  project: text("project").notNull(),
  origin: text("origin").notNull(),
  expires_at: integer("expires_at").notNull(),
  exchange_hash: text("exchange_hash").notNull(),
  session_token: text("session_token"),
  provider: text("provider").notNull().default("github"),
  approved_origins: text("approved_origins"),
});

export const rate_limits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires_at: integer("expires_at").notNull(),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  owner_id: text("owner_id").notNull(),
  repo: text("repo").notNull(),
  origins: text("origins").notNull(),
  suspended: integer("suspended").notNull().default(0),
  created_at: integer("created_at").notNull(),
});

export const project_owners = sqliteTable("project_owners", {
  project: text("project").primaryKey(),
  user_id: text("user_id").notNull(),
});

export const project_quotas = sqliteTable("project_quotas", {
  project: text("project").primaryKey(),
  max_comments: integer("max_comments").notNull(),
  max_bytes: integer("max_bytes").notNull(),
  comments: integer("comments").notNull().default(0),
  bytes: integer("bytes").notNull().default(0),
});

export const setup_requests = sqliteTable("setup_requests", {
  id: text("id").primaryKey(),
  poll_hash: text("poll_hash").notNull(),
  config: text("config").notNull(),
  project: text("project"),
  expires_at: integer("expires_at").notNull(),
});

export const workspace_domains = sqliteTable("workspace_domains", {
  project: text("project").notNull(),
  origin: text("origin").notNull(),
  verified_at: integer("verified_at").notNull(),
});

export const project_members = sqliteTable("project_members", {
  project: text("project").notNull(),
  user_id: text("user_id").notNull(),
});

export const scope_revisions = sqliteTable("scope_revisions", {
  project: text("project").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  version: integer("version").notNull().default(0),
});

export const project_settings = sqliteTable("project_settings", {
  project: text("project").primaryKey(),
  access: text("access").notNull().default("public"),
});

export const project_access = sqliteTable("project_access", {
  project: text("project").notNull(),
  user_id: text("user_id").notNull(),
});

export const project_invites = sqliteTable("project_invites", {
  token_hash: text("token_hash").primaryKey(),
  project: text("project").notNull(),
  email: text("email").notNull(),
  expires_at: integer("expires_at").notNull(),
});

export const export_revisions = sqliteTable("export_revisions", {
  project: text("project").primaryKey(),
  version: integer("version").notNull().default(0),
});

export const project_sites = sqliteTable("project_sites", {
  project: text("project").notNull(),
  origin: text("origin").notNull(),
  added_at: integer("added_at").notNull(),
  removed: integer("removed").notNull().default(0),
});
