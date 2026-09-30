import { canonicalPage } from "../src/page.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import type { Anchor } from "../src/types.js";

/** HTTP errors may include a stable code consumed by the client. */
export class HttpError extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    message: string,
    public code?: string,
  ) {
    super(status, { message });
  }
}

export function string(value: unknown, max: number, label: string): string {
  if (
    !(
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.length <= max
    )
  )
    throw new HttpError(400, `Invalid ${label}.`);
  return value.trim();
}
export function pagePath(value: unknown): string {
  const page = string(value, 2000, "page");
  if (
    !(
      page.startsWith("/") &&
      !page.startsWith("//") &&
      !/[?#\\]/.test(page) &&
      ![...page].some((char) => char.charCodeAt(0) < 32)
    )
  )
    throw new HttpError(400, "Invalid page path.");
  return canonicalPage(page);
}
export function anchorValue(value: unknown): Anchor {
  if (!(value && typeof value === "object"))
    throw new HttpError(400, "Invalid anchor.");
  const a = value as Record<string, unknown>;
  for (const key of [
    "x",
    "y",
    "width",
    "height",
    "pageX",
    "pageY",
    "viewportWidth",
  ]) {
    if (!(typeof a[key] === "number" && Number.isFinite(a[key]) && a[key] >= 0))
      throw new HttpError(400, `Invalid anchor ${key}.`);
  }
  for (const key of ["x", "y", "width", "height"])
    if (!(Number(a[key]) <= 1))
      throw new HttpError(400, "Anchor outside element.");
  if (
    !(
      Number(a.x) + Number(a.width) <= 1.001 &&
      Number(a.y) + Number(a.height) <= 1.001
    )
  )
    throw new HttpError(400, "Area outside element.");
  if (
    !(
      Number(a.viewportWidth) > 0 &&
      Number(a.viewportWidth) <= 20000 &&
      Number(a.pageY) <= 10000000 &&
      Number(a.pageX) <= 20000
    )
  )
    throw new HttpError(400, "Anchor outside page.");
  if (
    !(
      typeof a.selector === "string" &&
      a.selector.length <= 2000 &&
      typeof a.text === "string" &&
      a.text.length <= 160
    )
  )
    throw new HttpError(400, "Invalid anchor selector.");
  let context: Anchor["context"];
  if (a.context !== undefined) {
    if (
      !(a.context && typeof a.context === "object" && !Array.isArray(a.context))
    )
      throw new HttpError(400, "Invalid anchor context.");
    context = {};
    const supplied = a.context as Record<string, unknown>;
    for (const [key, max] of Object.entries({
      tag: 32,
      role: 80,
      label: 160,
      nearby: 160,
      classes: 200,
      selectedText: 200,
      styles: 500,
      scope: 2000,
    })) {
      if (supplied[key] === undefined) continue;
      if (!(typeof supplied[key] === "string" && supplied[key].length <= max))
        throw new HttpError(400, `Invalid anchor context ${key}.`);
      context[key as keyof typeof context] = supplied[key];
    }
  }
  const source =
    typeof a.source === "string" &&
    a.source.length <= 500 &&
    !a.source.includes("..") &&
    !a.source.startsWith("/")
      ? a.source
      : undefined;
  return {
    selector: a.selector,
    text: a.text,
    x: Number(a.x),
    y: Number(a.y),
    width: Number(a.width),
    height: Number(a.height),
    pageX: Number(a.pageX),
    pageY: Number(a.pageY),
    viewportWidth: Number(a.viewportWidth),
    source,
    ...(context ? { context } : {}),
    ...(a.unstacked === true ? { unstacked: true } : {}),
  };
}

/** A local dev server on any port. Browsers never send this from a remote site. */
export function localOrigin(origin: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * Every deploy of the same Cloudflare Pages project, derived from one of its
 * origins. Only that project's owner can publish under *.<project>.pages.dev.
 */
export function previewPattern(origin: string): string | undefined {
  const pages = /^https:\/\/(?:[a-z0-9-]+\.)?([a-z0-9-]+\.pages\.dev)$/.exec(
    origin,
  );
  return pages ? `https://*.${pages[1]}` : undefined;
}

export function originAllowed(origin: string, patterns: string[]): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  return patterns.some((pattern) => {
    if (!pattern.includes("*")) return pattern === origin;
    const escaped = pattern
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[a-zA-Z0-9-]+");
    return new RegExp(`^${escaped}$`).test(origin);
  });
}

/**
 * Validate an owner-approved site: an exact HTTPS origin, localhost, or an
 * HTTPS pattern with `*` in the leftmost host label only, such as
 * https://*-site.example.workers.dev. The wildcard never spans dots.
 */
export function sitePattern(value: unknown): string {
  if (!(typeof value === "string" && value.length <= 300))
    throw new HttpError(400, "Enter a site address.");
  const site = value.trim().replace(/\/$/, "").toLowerCase();
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(site)) return site;
  const match = /^https:\/\/([^/?#@]+)$/.exec(site);
  const host = match?.[1] ?? "";
  const [first = "", ...rest] = host.split(".");
  let url: URL | undefined;
  try {
    url = new URL(site);
  } catch {
    url = undefined;
  }
  if (
    !(
      !!match &&
      url?.origin === site &&
      !rest.join(".").includes("*") &&
      first.split("*").length - 1 <= 1 &&
      (!first.includes("*") ||
        (rest.length >= 2 && /^[a-z0-9*-]+$/.test(first)))
    )
  )
    throw new HttpError(
      400,
      "Use an HTTPS site like https://your-site.com, or a wildcard like https://*-preview.your-site.com.",
    );
  return site;
}

export function cliReturnOrigin(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string")
    throw new HttpError(400, "Invalid CLI return origin.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "Invalid CLI return origin.");
  }
  if (
    !(
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Number(url.port) >= 1024 &&
      url.origin === value
    )
  )
    throw new HttpError(
      400,
      "CLI sign-in must return to an ephemeral loopback port.",
    );
  return url.origin;
}
