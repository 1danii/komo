import type { CommentsApi } from "./api.js";
import { button, el, icon, setButtonBusy } from "./dom.js";

type SiteList = { sites: string[]; fixed: string[] };

/** Normalize a typed site into an origin, keeping a `*` host wildcard. */
export function siteInput(value: string): string {
  const site = value.trim().replace(/\/$/, "").toLowerCase();
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(site)) return site;
  const match = /^https:\/\/([^/?#@\s]+)$/.exec(
    site.includes("://") ? site : `https://${site}`
  );
  const [first = "", ...rest] = (match?.[1] ?? "").split(".");
  if (
    !match ||
    rest.length < 1 ||
    rest.join(".").includes("*") ||
    first.split("*").length > 2 ||
    (first.includes("*") && rest.length < 2)
  )
    throw new Error(
      "That doesn’t look like a site. Try your-site.com or *-preview.your-site.com."
    );
  return `https://${match[1]}`;
}

/**
 * Owner-only editor for the sites allowed to load this project's comments.
 * Collapsed by default; resolves to null when the viewer cannot manage the
 * project.
 */
export async function approvedSites(
  api: CommentsApi,
  suffix = ""
): Promise<HTMLElement | null> {
  let sites: string[];
  try {
    const result = await api.request<SiteList>(`project/sites${suffix}`);
    // Older APIs list config sites separately.
    sites = [...result.fixed, ...result.sites];
  } catch {
    return null;
  }
  const section = el("div", "approved-sites-editor");
  section.dataset.open = "false";
  const count = el("span", "approved-sites-count");
  const toggle = button(
    "Sites with comments",
    () => {
      const open = section.dataset.open !== "true";
      section.dataset.open = String(open);
      toggle.setAttribute("aria-expanded", String(open));
      reveal.inert = !open;
    },
    "approved-sites-toggle"
  );
  toggle.replaceChildren(
    el("span", "", "Sites with comments"),
    count,
    icon("chevron")
  );
  toggle.setAttribute("aria-expanded", "false");
  const reveal = el("div", "approved-sites-reveal");
  reveal.id = `approved-sites-${crypto.randomUUID()}`;
  reveal.inert = true;
  toggle.setAttribute("aria-controls", reveal.id);
  const body = el("div", "approved-sites-body");
  const rows = el("ul", "approved-site-list");
  const status = el("p", "account-usage-status");
  status.setAttribute("role", "status");
  const form = el("div", "approved-site-add");
  const input = el("input");
  input.type = "text";
  input.inputMode = "url";
  input.spellcheck = false;
  input.placeholder = "your-site.com";
  input.setAttribute("aria-label", "Site to approve");
  input.setAttribute("autocomplete", "off");
  const note = el("div", "account-usage-note account-sites-note");
  note.append(
    icon("info"),
    el(
      "span",
      "",
      "Only these sites can show comments. Add * to cover preview links."
    )
  );
  const save = async (next: string[]) => {
    const previous = sites;
    sites = next;
    render();
    status.textContent = "";
    try {
      const result = await api.request<SiteList>(
        `project/sites${suffix}`,
        "PATCH",
        { sites: next }
      );
      sites = [...result.fixed, ...result.sites];
      render();
      return true;
    } catch (error) {
      sites = previous;
      render();
      status.textContent =
        error instanceof Error ? error.message : "Try again.";
      return false;
    }
  };
  const add = button(
    "Add",
    async () => {
      let site: string;
      try {
        site = siteInput(input.value);
      } catch (error) {
        status.textContent = (error as Error).message;
        return;
      }
      if (sites.includes(site)) {
        input.value = "";
        status.textContent = "Already on the list.";
        return;
      }
      const typed = input.value;
      input.value = "";
      setButtonBusy(add);
      if (!(await save([...sites, site]))) input.value ||= typed;
      setButtonBusy(add, false);
      input.focus();
    },
    "secondary"
  );
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add.click();
    }
  });
  form.append(input, add);
  const row = (site: string) => {
    const item = el("li", "approved-site");
    const label = el("span", "", site.replace(/^https:\/\//, ""));
    label.title = site;
    item.append(
      label,
      button(
        `Remove ${site}`,
        () => void save(sites.filter((value) => value !== site)),
        "icon",
        "close"
      )
    );
    return item;
  };
  const render = () => {
    count.textContent = String(sites.length);
    rows.replaceChildren(...sites.map(row));
  };
  render();
  body.append(rows, form, note, status);
  reveal.append(body);
  section.append(toggle, reveal);
  return section;
}
