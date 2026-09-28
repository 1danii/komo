-- PostgreSQL schema for the Node runtime. Mirrors SQLite migrations 0001-0015.
CREATE TABLE users (id text PRIMARY KEY, name text NOT NULL, verified integer NOT NULL DEFAULT 0, avatar_url text, accent_color text, email text);
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), project text NOT NULL, expires_at bigint NOT NULL);
CREATE INDEX session_expiry ON sessions(expires_at);
CREATE TABLE threads (id text PRIMARY KEY, project text NOT NULL, repo text NOT NULL, branch text NOT NULL, page text NOT NULL, anchor text NOT NULL, resolved integer NOT NULL DEFAULT 0, resolved_by text REFERENCES users(id), created_at bigint NOT NULL, updated_at bigint NOT NULL);
CREATE INDEX thread_scope ON threads(project,repo,branch,updated_at);
CREATE INDEX thread_created_scope ON threads(project,repo,branch,created_at,id);
CREATE TABLE comments (seq bigint GENERATED ALWAYS AS IDENTITY, id text PRIMARY KEY, thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id), body text NOT NULL, created_at bigint NOT NULL, edited_at bigint);
CREATE INDEX comment_thread ON comments(thread_id,created_at);
CREATE INDEX comments_reviewer_history ON comments(user_id,created_at DESC);
CREATE TABLE reactions (comment_id text NOT NULL REFERENCES comments(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id), emoji text NOT NULL, PRIMARY KEY(comment_id,user_id,emoji));
CREATE TABLE oauth_states (state_hash text PRIMARY KEY, verifier text NOT NULL, project text NOT NULL, origin text NOT NULL, expires_at bigint NOT NULL, exchange_hash text NOT NULL, session_token text, provider text NOT NULL DEFAULT 'github', approved_origins text);
CREATE INDEX oauth_state_expiry ON oauth_states(expires_at);
CREATE TABLE rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at bigint NOT NULL);
CREATE INDEX rate_limit_expiry ON rate_limits(expires_at);
CREATE TABLE workspaces (id text PRIMARY KEY, owner_id text NOT NULL REFERENCES users(id), repo text NOT NULL, origins text NOT NULL, suspended integer NOT NULL DEFAULT 0, created_at bigint NOT NULL, CHECK(owner_id LIKE 'google:%'));
CREATE INDEX workspace_owner ON workspaces(owner_id);
CREATE TABLE project_owners (project text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), CHECK(user_id LIKE 'google:%'));
CREATE TABLE project_quotas (project text PRIMARY KEY, max_comments integer NOT NULL, max_bytes bigint NOT NULL, comments integer NOT NULL DEFAULT 0, bytes bigint NOT NULL DEFAULT 0);
CREATE TABLE setup_requests (id text PRIMARY KEY, poll_hash text NOT NULL, config text NOT NULL, project text, expires_at bigint NOT NULL);
CREATE INDEX setup_request_expiry ON setup_requests(expires_at);
CREATE TABLE workspace_domains (project text NOT NULL REFERENCES workspaces(id), origin text NOT NULL, verified_at bigint NOT NULL, PRIMARY KEY(project,origin));
CREATE TABLE project_members (project text NOT NULL, user_id text NOT NULL REFERENCES users(id), PRIMARY KEY(project,user_id));
CREATE TABLE scope_revisions (project text NOT NULL, repo text NOT NULL, branch text NOT NULL, version bigint NOT NULL DEFAULT 0, PRIMARY KEY(project,repo,branch));
CREATE TABLE project_settings (project text PRIMARY KEY, access text NOT NULL DEFAULT 'public' CHECK(access IN ('public','private')));
CREATE TABLE project_access (project text NOT NULL, user_id text NOT NULL REFERENCES users(id), PRIMARY KEY(project,user_id));
CREATE TABLE project_invites (token_hash text PRIMARY KEY, project text NOT NULL, email text NOT NULL, expires_at bigint NOT NULL);
CREATE INDEX invite_project ON project_invites(project,expires_at);
CREATE INDEX invite_expiry ON project_invites(expires_at);
CREATE TABLE export_revisions (project text PRIMARY KEY, version bigint NOT NULL DEFAULT 0);
CREATE TABLE project_sites (project text NOT NULL, origin text NOT NULL, added_at bigint NOT NULL, removed integer NOT NULL DEFAULT 0, PRIMARY KEY(project,origin));

CREATE FUNCTION komo_quota(p_project text, p_comments integer, p_bytes bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE project_quotas SET comments=GREATEST(0,comments+p_comments), bytes=GREATEST(0,bytes+p_bytes) WHERE project=p_project;
  IF EXISTS(SELECT 1 FROM project_quotas WHERE project=p_project AND (comments>max_comments OR bytes>max_bytes)) THEN
    RAISE EXCEPTION 'komo_quota_exceeded';
  END IF;
END $$;
CREATE FUNCTION komo_scope(p_project text,p_repo text,p_branch text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO scope_revisions(project,repo,branch,version) VALUES(p_project,p_repo,p_branch,1)
  ON CONFLICT(project,repo,branch) DO UPDATE SET version=scope_revisions.version+1;
END $$;
CREATE FUNCTION komo_export(p_project text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_project IS NOT NULL THEN
    INSERT INTO export_revisions(project,version) VALUES(p_project,1)
    ON CONFLICT(project) DO UPDATE SET version=export_revisions.version+1;
  END IF;
END $$;
CREATE FUNCTION komo_thread_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM komo_quota(OLD.project,0,-(octet_length(OLD.anchor)+octet_length(OLD.page)+octet_length(OLD.branch)+512));
    PERFORM komo_scope(OLD.project,OLD.repo,OLD.branch);
    PERFORM komo_export(OLD.project);
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    PERFORM komo_quota(NEW.project,0,octet_length(NEW.anchor)+octet_length(NEW.page)+octet_length(NEW.branch)+512);
  ELSE
    PERFORM komo_quota(NEW.project,0,octet_length(NEW.anchor)-octet_length(OLD.anchor));
  END IF;
  PERFORM komo_scope(NEW.project,NEW.repo,NEW.branch);
  PERFORM komo_export(NEW.project);
  RETURN NEW;
END $$;
CREATE FUNCTION komo_thread_children() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('komo.deleting_thread',OLD.id,true);
  DELETE FROM comments WHERE thread_id=OLD.id;
  PERFORM set_config('komo.deleting_thread','',true);
  RETURN OLD;
END $$;
CREATE TRIGGER thread_children BEFORE DELETE ON threads FOR EACH ROW EXECUTE FUNCTION komo_thread_children();
CREATE TRIGGER thread_change AFTER INSERT OR UPDATE OR DELETE ON threads FOR EACH ROW EXECUTE FUNCTION komo_thread_change();
CREATE FUNCTION komo_comment_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p text;
BEGIN
  SELECT project INTO p FROM threads WHERE id=COALESCE(NEW.thread_id,OLD.thread_id);
  IF TG_OP='INSERT' THEN
    PERFORM komo_quota(p,1,octet_length(NEW.body)+256);
  ELSIF TG_OP='UPDATE' THEN
    PERFORM komo_quota(p,0,octet_length(NEW.body)-octet_length(OLD.body));
  ELSE
    PERFORM komo_quota(p,-1,-(octet_length(OLD.body)+256));
    IF current_setting('komo.deleting_thread',true) IS DISTINCT FROM OLD.thread_id THEN
      UPDATE threads SET updated_at=GREATEST(updated_at+1,(extract(epoch FROM clock_timestamp())*1000)::bigint) WHERE id=OLD.thread_id;
    END IF;
  END IF;
  PERFORM komo_export(p);
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE FUNCTION komo_comment_children() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM reactions WHERE comment_id=OLD.id;
  RETURN OLD;
END $$;
CREATE TRIGGER comment_children BEFORE DELETE ON comments FOR EACH ROW EXECUTE FUNCTION komo_comment_children();
CREATE TRIGGER comment_change AFTER INSERT OR UPDATE OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION komo_comment_change();
CREATE FUNCTION komo_reaction_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p text;
BEGIN
  SELECT t.project INTO p FROM comments c JOIN threads t ON t.id=c.thread_id WHERE c.id=COALESCE(NEW.comment_id,OLD.comment_id);
  IF TG_OP='INSERT' THEN PERFORM komo_quota(p,0,256);
  ELSIF TG_OP='DELETE' THEN PERFORM komo_quota(p,0,-256);
  END IF;
  PERFORM komo_export(p);
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER reaction_change AFTER INSERT OR UPDATE OR DELETE ON reactions FOR EACH ROW EXECUTE FUNCTION komo_reaction_change();
CREATE FUNCTION komo_member_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN PERFORM komo_quota(NEW.project,0,13312);
  ELSE PERFORM komo_quota(OLD.project,0,-13312);
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER member_change AFTER INSERT OR DELETE ON project_members FOR EACH ROW EXECUTE FUNCTION komo_member_change();
CREATE FUNCTION komo_profile_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE scope_revisions SET version=version+1 WHERE (project,repo,branch) IN
    (SELECT t.project,t.repo,t.branch FROM threads t JOIN comments c ON c.thread_id=t.id WHERE c.user_id=NEW.id);
  UPDATE export_revisions SET version=version+1 WHERE project IN (SELECT project FROM project_members WHERE user_id=NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER profile_change AFTER UPDATE ON users FOR EACH ROW EXECUTE FUNCTION komo_profile_change();
