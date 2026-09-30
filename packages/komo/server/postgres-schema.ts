import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";

// Existing SQL migrations own constraints, indexes, and triggers.
// These declarations map stored columns for native Drizzle queries.

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  verified: integer("verified").notNull().default(0),
  avatar_url: text("avatar_url"),
  accent_color: text("accent_color"),
  email: text("email"),
});

export const sessions = pgTable("sessions", {
  token_hash: text("token_hash").primaryKey(),
  user_id: text("user_id").notNull(),
  project: text("project").notNull(),
  expires_at: bigint("expires_at", { mode: "number" }).notNull(),
});

export const threads = pgTable("threads", {
  id: text("id").primaryKey(),
  project: text("project").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  page: text("page").notNull(),
  anchor: text("anchor").notNull(),
  resolved: integer("resolved").notNull().default(0),
  resolved_by: text("resolved_by"),
  created_at: bigint("created_at", { mode: "number" }).notNull(),
  updated_at: bigint("updated_at", { mode: "number" }).notNull(),
});

export const comments = pgTable("comments", {
  seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
  id: text("id").primaryKey(),
  thread_id: text("thread_id").notNull(),
  user_id: text("user_id").notNull(),
  body: text("body").notNull(),
  created_at: bigint("created_at", { mode: "number" }).notNull(),
  edited_at: bigint("edited_at", { mode: "number" }),
});

export const reactions = pgTable("reactions", {
  comment_id: text("comment_id").notNull(),
  user_id: text("user_id").notNull(),
  emoji: text("emoji").notNull(),
});

export const oauth_states = pgTable("oauth_states", {
  state_hash: text("state_hash").primaryKey(),
  verifier: text("verifier").notNull(),
  project: text("project").notNull(),
  origin: text("origin").notNull(),
  expires_at: bigint("expires_at", { mode: "number" }).notNull(),
  exchange_hash: text("exchange_hash").notNull(),
  session_token: text("session_token"),
  provider: text("provider").notNull().default("github"),
  approved_origins: text("approved_origins"),
});

export const rate_limits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires_at: bigint("expires_at", { mode: "number" }).notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  owner_id: text("owner_id").notNull(),
  repo: text("repo").notNull(),
  origins: text("origins").notNull(),
  suspended: integer("suspended").notNull().default(0),
  created_at: bigint("created_at", { mode: "number" }).notNull(),
});

export const project_owners = pgTable("project_owners", {
  project: text("project").primaryKey(),
  user_id: text("user_id").notNull(),
});

export const project_quotas = pgTable("project_quotas", {
  project: text("project").primaryKey(),
  max_comments: integer("max_comments").notNull(),
  max_bytes: bigint("max_bytes", { mode: "number" }).notNull(),
  comments: integer("comments").notNull().default(0),
  bytes: bigint("bytes", { mode: "number" }).notNull().default(0),
});

export const setup_requests = pgTable("setup_requests", {
  id: text("id").primaryKey(),
  poll_hash: text("poll_hash").notNull(),
  config: text("config").notNull(),
  project: text("project"),
  expires_at: bigint("expires_at", { mode: "number" }).notNull(),
});

export const workspace_domains = pgTable("workspace_domains", {
  project: text("project").notNull(),
  origin: text("origin").notNull(),
  verified_at: bigint("verified_at", { mode: "number" }).notNull(),
});

export const project_members = pgTable("project_members", {
  project: text("project").notNull(),
  user_id: text("user_id").notNull(),
});

export const scope_revisions = pgTable("scope_revisions", {
  project: text("project").notNull(),
  repo: text("repo").notNull(),
  branch: text("branch").notNull(),
  version: bigint("version", { mode: "number" }).notNull().default(0),
});

export const project_settings = pgTable("project_settings", {
  project: text("project").primaryKey(),
  access: text("access").notNull().default("public"),
});

export const project_access = pgTable("project_access", {
  project: text("project").notNull(),
  user_id: text("user_id").notNull(),
});

export const project_invites = pgTable("project_invites", {
  token_hash: text("token_hash").primaryKey(),
  project: text("project").notNull(),
  email: text("email").notNull(),
  expires_at: bigint("expires_at", { mode: "number" }).notNull(),
});

export const export_revisions = pgTable("export_revisions", {
  project: text("project").primaryKey(),
  version: bigint("version", { mode: "number" }).notNull().default(0),
});

export const project_sites = pgTable("project_sites", {
  project: text("project").notNull(),
  origin: text("origin").notNull(),
  added_at: bigint("added_at", { mode: "number" }).notNull(),
  removed: integer("removed").notNull().default(0),
});
