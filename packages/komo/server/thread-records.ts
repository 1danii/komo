/** Thread read shape includes optional resolver identity from the joined user. */
export type ThreadRow = {
  id: string;
  page: string;
  anchor: string;
  resolved: number;
  resolved_by: string | null;
  created_at: number;
  updated_at: number;
  resolver_name: string | null;
  resolver_verified: number | null;
};
/** Comment read shape includes author profile fields, with millisecond timestamps. */
export type CommentRow = {
  id: string;
  thread_id: string;
  body: string;
  user_id: string;
  avatar_url?: string | null;
  accent_color?: string | null;
  name: string;
  verified: number;
  created_at: number;
  edited_at: number | null;
};
