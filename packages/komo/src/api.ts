import type { CommentsOptions, Identity, Thread } from "./types.js";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
// Validate persisted/network data before it reaches rendering code.
function identity(value: Identity): boolean {
  return (
    !!value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.verified === "boolean" &&
    [value.avatarUrl, value.accentColor].every(
      (v) => v === undefined || typeof v === "string",
    )
  );
}
function anchorContext(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const limits: Record<string, number> = {
    tag: 32,
    role: 80,
    label: 160,
    nearby: 160,
    classes: 200,
    selectedText: 200,
    styles: 500,
    scope: 2000,
  };
  return Object.entries(value).every(
    ([key, text]) =>
      typeof limits[key] === "number" &&
      typeof text === "string" &&
      text.length <= limits[key],
  );
}
function threadList(value: unknown): value is Thread[] {
  return (
    Array.isArray(value) &&
    value.every(
      (t: Thread) =>
        t &&
        typeof t.id === "string" &&
        typeof t.page === "string" &&
        typeof t.resolved === "boolean" &&
        (t.githubIssue === undefined ||
          (t.githubIssue &&
            typeof t.githubIssue.repository === "string" &&
            /^https:\/\/github\.com\//.test(t.githubIssue.url) &&
            Number.isSafeInteger(t.githubIssue.number))) &&
        Number.isFinite(t.createdAt) &&
        Number.isFinite(t.updatedAt) &&
        (t.resolvedBy === null || identity(t.resolvedBy)) &&
        t.anchor &&
        (!("context" in t.anchor) || anchorContext(t.anchor.context)) &&
        typeof t.anchor.selector === "string" &&
        typeof t.anchor.text === "string" &&
        [
          t.anchor.x,
          t.anchor.y,
          t.anchor.width,
          t.anchor.height,
          t.anchor.pageX,
          t.anchor.pageY,
          t.anchor.viewportWidth,
        ].every(Number.isFinite) &&
        Array.isArray(t.comments) &&
        t.comments.every(
          (c) =>
            c &&
            typeof c.id === "string" &&
            typeof c.body === "string" &&
            identity(c.author) &&
            Number.isFinite(c.createdAt) &&
            (c.editedAt === null || Number.isFinite(c.editedAt)) &&
            c.reactions &&
            typeof c.reactions === "object" &&
            !Array.isArray(c.reactions) &&
            Object.values(c.reactions).every(
              (ids) =>
                Array.isArray(ids) && ids.every((id) => typeof id === "string"),
            ),
        ),
    )
  );
}
// Compact wire/cache records share each author's avatar once. Legacy servers
// still return inline identities; validate the hydrated result in either case.
function expandThreads(
  value: unknown,
  authors?: Record<string, Identity>,
): unknown {
  if (!authors || !Array.isArray(value)) return value;
  const author = (value: unknown) =>
    typeof value === "string"
      ? Object.hasOwn(authors, value)
        ? authors[value]
        : undefined
      : value;
  return value.map(
    (thread) =>
      thread && {
        ...thread,
        resolvedBy: author(thread.resolvedBy),
        comments:
          Array.isArray(thread.comments) &&
          thread.comments.map(
            (comment: Thread["comments"][number]) =>
              comment && {
                ...comment,
                author: author(comment.author),
              },
          ),
      },
  );
}

function invalidResponse() {
  return new ApiError(
    0,
    "Could not read comments. Try again.",
    "invalid_response",
  );
}
export class CommentsApi {
  githubRepository: string | null = null;
  token: string | null = null;
  user: Identity | null = null;
  transient = false;
  private revision: number | undefined;
  private cachedThreads: Thread[] = [];
  private reads = new AbortController();
  private persistenceQueued = false;
  private persistenceBlocked = false;
  private key: string;
  private cookieName: string;
  private cookieDomain: string;
  constructor(private options: CommentsOptions) {
    const scope = new URL(
      options.sessionEndpoint ?? options.endpoint,
    ).href.replace(/\/$/, "");
    const domain = options.sessionDomain?.replace(/^\./, "") ?? "";
    this.cookieDomain =
      domain &&
      (location.hostname === domain || location.hostname.endsWith(`.${domain}`))
        ? domain
        : "";
    this.cookieName = `${this.cookieDomain ? "__Secure-" : "__Host-"}bc-session-${encodeURIComponent(JSON.stringify([scope, options.project]))}`;
    this.key = `branch-comments:${options.endpoint}:${options.project}`;
    let cookiePresent = false;
    try {
      const cookie = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith(`${this.cookieName}=`));
      cookiePresent = cookie !== undefined;
      this.token = cookie?.slice(this.cookieName.length + 1) || null;
    } catch {
      /* Cookies may be blocked independently from local storage. */
    }
    try {
      // Account snapshots also contain an endpoint-scoped, previously validated session.
      let known;
      try {
        known = JSON.parse(localStorage.getItem(this.userKey) ?? "null");
      } catch {
        /* Ignore corrupt account metadata. */
      }
      const local =
        localStorage.getItem(this.key) ??
        (identity(known?.user) && typeof known.token === "string"
          ? known.token
          : null);
      if (!cookiePresent) this.token = local;
      else if (!this.token && local) this.clear();
      // Last known account, shown at once; restore() confirms it with /me.
      if (this.token && known?.token === this.token && identity(known.user))
        this.user = known.user;
    } catch {
      /* Private browsers can disable storage. */
    }
    // Retire project-only legacy cookies; only scoped local storage may migrate a session.
    try {
      const name = `bc-session-${encodeURIComponent(options.project)}`;
      const parent = location.hostname.match(
        /^[^.]+\.([^.]+\.(?:workers|pages)\.dev)$/,
      )?.[1];
      for (const domain of new Set(["", this.cookieDomain, parent]))
        if (domain !== undefined)
          document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    } catch {
      /* Cookies may be disabled. */
    }
  }
  get sessionKey() {
    return this.key;
  }
  private get userKey() {
    return `${this.key}:user`;
  }
  private rememberUser() {
    try {
      if (this.token && this.user)
        localStorage.setItem(
          this.userKey,
          JSON.stringify({ token: this.token, user: this.user }),
        );
      else localStorage.removeItem(this.userKey);
    } catch {
      /* The account reloads from the server next time. */
    }
  }
  // End obsolete GETs without cancelling intentional writes or profile flushes.
  cancelReads() {
    this.reads.abort();
    this.reads = new AbortController();
  }
  async request<T>(path: string, method = "GET", data?: unknown): Promise<T> {
    const url = new URL(path, this.options.endpoint.replace(/\/?$/, "/"));
    url.searchParams.set("project", this.options.project);
    url.searchParams.set("repo", this.options.repo);
    url.searchParams.set("branch", this.options.branch);
    const headers: Record<string, string> = {};
    const token = this.token;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (data !== undefined) headers["Content-Type"] = "application/json";
    const readSignal = method === "GET" ? this.reads.signal : undefined;
    const timeout = AbortSignal.timeout(15000);
    const response = await fetch(url, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
      credentials: "omit",
      cache: "no-store",
      signal: readSignal ? AbortSignal.any([readSignal, timeout]) : timeout,
    }).catch((error: unknown) => {
      // Browsers hide why a request failed; offline is the one case we can tell.
      if (error instanceof TypeError)
        throw navigator.onLine === false
          ? new ApiError(0, "You’re offline.", "offline")
          : new ApiError(0, "Can’t connect to comments.", "unreachable");
      throw error;
    });
    readSignal?.throwIfAborted();
    const result = await response.json().catch(() => {
      readSignal?.throwIfAborted();
      if (response.ok) throw invalidResponse();
      return {};
    });
    readSignal?.throwIfAborted();
    if (
      response.ok &&
      (!result || typeof result !== "object" || Array.isArray(result))
    )
      throw invalidResponse();
    if (!response.ok) {
      if (response.status === 401 && this.token === token) this.clear();
      if (result?.code === "site_not_approved")
        throw new ApiError(
          response.status,
          "Comments aren’t turned on for this site yet.",
          result?.code,
        );
      throw new ApiError(
        response.status,
        result?.error ?? "Could not load comments.",
        result?.code,
      );
    }
    return result as T;
  }
  // A bounded last-known snapshot paints immediately. Partial snapshots never
  // carry a revision: the next load must retrieve the omitted threads.
  private get listKey() {
    return `${this.key}:${JSON.stringify([this.options.repo, this.options.branch])}:threads`;
  }
  cached(): Thread[] | null {
    try {
      const stored = JSON.parse(localStorage.getItem(this.listKey) ?? "null");
      if (stored)
        stored.threads = expandThreads(stored.threads, stored.authors);
      if (
        stored?.token !== (this.token ?? "") ||
        !threadList(stored.threads) ||
        (stored.revision !== undefined &&
          (!Number.isSafeInteger(stored.revision) || stored.revision < 0))
      )
        return null;
      this.revision = stored.revision;
      this.cachedThreads = stored.threads;
      return stored.threads;
    } catch {
      return null;
    }
  }
  private persist() {
    if (this.persistenceQueued || this.persistenceBlocked) return;
    this.persistenceQueued = true;
    queueMicrotask(() => {
      this.persistenceQueued = false;
      try {
        const authors: Record<string, Identity> = Object.create(null);
        const threads: unknown[] = [];
        let size = 0;
        let partial = false;
        const page = this.options.page?.() ?? location.pathname;
        // Current-page feedback gets first claim on the 250k-character cache.
        const ordered = [...this.cachedThreads].sort(
          (a, b) => Number(b.page === page) - Number(a.page === page),
        );
        for (const thread of ordered) {
          const additions: Record<string, Identity> = Object.create(null);
          const author = (user: Identity | null) => {
            if (user)
              additions[user.id] = {
                ...authors[user.id],
                ...additions[user.id],
                ...user,
              };
            return user?.id ?? null;
          };
          const compact = {
            ...thread,
            resolvedBy: author(thread.resolvedBy),
            comments: thread.comments.map((comment) => ({
              ...comment,
              author: author(comment.author),
            })),
          };
          const cost =
            JSON.stringify(compact).length +
            Object.entries(additions).reduce(
              (cost, [id, user]) =>
                cost +
                JSON.stringify([id, user]).length -
                (authors[id] ? JSON.stringify([id, authors[id]]).length : 0),
              0,
            ) +
            2;
          if (size + cost > 250_000) {
            partial = true;
            continue;
          }
          size += cost;
          Object.assign(authors, additions);
          threads.push(compact);
        }
        if (partial && !threads.length) {
          localStorage.removeItem(this.listKey);
          return;
        }
        localStorage.setItem(
          this.listKey,
          JSON.stringify({
            token: this.token ?? "",
            revision: partial ? undefined : this.revision,
            threads,
            authors,
          }),
        );
      } catch {
        // Do not repeatedly serialize snapshots into a full/disabled store.
        this.persistenceBlocked = true;
        try {
          localStorage.removeItem(this.listKey);
        } catch {
          /* Storage disabled. */
        }
      }
    });
  }
  async list(): Promise<Thread[]> {
    const token = this.token;
    const signal = this.reads.signal;
    const threads: Thread[] = [];
    let offset: number | null = 0;
    let cursor: string | undefined;
    let revision: number | undefined;
    while (offset !== null) {
      type ListResponse = {
        githubRepository?: string | null;
        threads?: Thread[];
        authors?: Record<string, Identity>;
        next?: number | null;
        nextCursor?: string | null;
        revision?: number;
        notModified?: boolean;
      };
      const result: ListResponse = await this.request<ListResponse>(
        `threads?authors=1&offset=${offset}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}${offset === 0 && this.revision !== undefined ? `&revision=${this.revision}` : ""}`,
      ).catch((error: unknown) => {
        if (
          error instanceof ApiError &&
          error.status === 403 &&
          this.token === token
        ) {
          this.revision = undefined;
          this.cachedThreads = [];
          this.persist();
        }
        throw error;
      });
      signal.throwIfAborted();
      this.githubRepository =
        typeof result.githubRepository === "string"
          ? result.githubRepository
          : null;
      result.threads = expandThreads(
        result.threads,
        result.authors,
      ) as Thread[];
      if (
        result.notModified === true &&
        offset === 0 &&
        this.revision !== undefined
      )
        return this.cachedThreads;
      if (
        !threadList(result.threads) ||
        (result.nextCursor != null &&
          (typeof result.nextCursor !== "string" ||
            result.nextCursor.length > 200 ||
            result.nextCursor === cursor)) ||
        (result.revision !== undefined &&
          (!Number.isSafeInteger(result.revision) || result.revision < 0)) ||
        (result.next != null &&
          (!Number.isSafeInteger(result.next) || result.next <= offset))
      )
        throw invalidResponse();
      if (offset === 0) revision = result.revision;
      threads.push(...(result.threads ?? []));
      cursor = result.nextCursor ?? undefined;
      offset = result.next ?? null;
    }
    this.revision = revision;
    this.cachedThreads = threads;
    this.persist();
    return threads;
  }
  save(data: { token: string; user: Identity }) {
    if (data.token !== this.token) {
      this.cancelReads();
      this.revision = undefined;
      this.cachedThreads = [];
    }
    this.token = data.token;
    this.user = data.user;
    this.rememberUser();
    let stored = false;
    try {
      localStorage.setItem(this.key, data.token);
      stored = true;
      // Browsers cap cookie Max-Age at 400 days; the service session lasts far
      // longer and localStorage keeps the token beyond the cookie's lifetime.
    } catch {
      /* Session remains usable for this tab. */
    }
    this.transient = !this.writeCookie(data.token, 400 * 86400) && !stored;
  }
  private writeCookie(value: string, maxAge: number) {
    if (location.protocol !== "https:") return;
    const attributes = "Path=/; SameSite=Lax; Secure";
    try {
      // A host-only cookie from before sharing would shadow the shared one.
      if (this.cookieDomain)
        document.cookie = `${this.cookieName}=; Max-Age=0; ${attributes}`;
      document.cookie = `${this.cookieName}=${value}; Max-Age=${maxAge}; ${attributes}${this.cookieDomain ? `; Domain=${this.cookieDomain}` : ""}`;
      return document.cookie
        .split("; ")
        .includes(`${this.cookieName}=${value}`);
    } catch {
      /* Storage may be unavailable in this browser. */
    }
  }
  clear() {
    this.cancelReads();
    try {
      localStorage.removeItem(this.listKey);
      // Clear every channel's snapshot, including legacy keys containing tokens.
      for (const key of Object.keys(localStorage))
        if (key.startsWith(`${this.key}:`)) localStorage.removeItem(key);
    } catch {
      /* Nothing cached. */
    }
    this.revision = undefined;
    this.cachedThreads = [];
    this.token = null;
    this.user = null;
    this.transient = false;
    this.rememberUser();
    // An empty shared cookie prevents another preview's local fallback reviving logout.
    this.writeCookie("", 400 * 86400);
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* No persistent session. */
    }
  }
  async restore() {
    if (!this.token) return;
    const token = this.token;
    const result = await this.request<{ user: Identity }>("me");
    if (this.token !== token) return;
    if (!identity(result.user)) throw invalidResponse();
    this.save({ token, user: result.user });
  }
  async guest(name: string) {
    this.save(await this.request("auth/guest", "POST", { name }));
  }
  async logout() {
    const request = this.request("me", "DELETE");
    this.clear();
    // A failed remote revocation must never sign this browser back in.
    await request;
  }
}
