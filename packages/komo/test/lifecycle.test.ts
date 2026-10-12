// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initComments } from "../src/index";
import type { CommentsController, CommentsOptions, Thread } from "../src/types";

let controller: CommentsController | undefined;
const options: CommentsOptions = {
  endpoint: "https://example.test",
  project: "fixture",
  repo: "fixture",
  branch: "main",
  onboarding: { inProject: true },
};
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: () => [],
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "scrollBy").mockImplementation(() => {});
});
afterEach(() => {
  controller?.destroy();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it("rejects another scope and keeps a replacement safe from stale teardown", () => {
  const first = initComments(options);
  controller = first;
  expect(initComments({ ...options })).toBe(first);
  for (const change of [
    { project: "other" },
    { branch: "other" },
    { endpoint: "https://other.test" },
  ])
    expect(() => initComments({ ...options, ...change })).toThrow(
      "Destroy the current",
    );
  first.destroy();
  controller = initComments({ ...options, branch: "next" });
  const host = [...document.body.children].find((node) => node.shadowRoot)!;
  document.body.style.background = "red";
  first.destroy();
  first.open();
  first.close();
  expect(host.isConnected).toBe(true);
  expect(document.body.style.background).toBe("red");
  expect(initComments({ ...options, branch: "next" })).toBe(controller);
});

it("updates GitHub conversion on an open thread when only connection availability changes", async () => {
  const { CommentsApi } = await import("../src/api");
  const config = { ...options, onboarding: undefined };
  const api = new CommentsApi(config);
  api.save({
    token: "github-review",
    user: { id: "google:owner", name: "Owner", verified: true },
  });
  const threads: Thread[] = [
    {
      id: "github-review",
      page: "/",
      resolved: false,
      resolvedBy: null,
      createdAt: 1,
      updatedAt: 1,
      anchor: {
        selector: "body",
        text: "",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        pageX: 0,
        pageY: 0,
        viewportWidth: 1200,
      },
      comments: [
        {
          id: "comment",
          body: "Review",
          author: api.user!,
          createdAt: 1,
          editedAt: null,
          reactions: {},
        },
      ],
    },
  ];
  let repository: string | null = null;
  vi.spyOn(CommentsApi.prototype, "restore").mockResolvedValue(undefined);
  vi.spyOn(CommentsApi.prototype, "request").mockResolvedValue({
    google: true,
    guests: true,
    guestResolve: true,
  });
  vi.spyOn(CommentsApi.prototype, "list").mockImplementation(async function () {
    this.githubRepository = repository;
    return threads; // The same cached array is returned for unchanged revisions.
  });
  controller = initComments(config);
  controller.open();
  const shadow = [...document.body.children].find(
    (node) => node.shadowRoot,
  )!.shadowRoot!;
  await vi.waitFor(() =>
    expect(
      shadow.querySelector('[aria-label="Open comment by Owner"]'),
    ).not.toBeNull(),
  );
  shadow
    .querySelector<HTMLButtonElement>('[aria-label="Open comment by Owner"]')!
    .click();
  expect(
    shadow.querySelector('[aria-label="Convert to GitHub issue"]'),
  ).toBeNull();
  repository = "owner/repo";
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(() =>
    expect(
      shadow.querySelector('[aria-label="Convert to GitHub issue"]'),
    ).not.toBeNull(),
  );
  repository = null;
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(() =>
    expect(
      shadow.querySelector('[aria-label="Convert to GitHub issue"]'),
    ).toBeNull(),
  );
  api.clear();
});

it("rejects unsafe endpoint schemes and embedded credentials before mounting", () => {
  for (const endpoint of [
    "ftp://localhost",
    "http://public.example.test",
    "https://user:password@example.test",
  ])
    expect(() => initComments({ ...options, endpoint })).toThrow(
      "HTTPS API endpoint",
    );
  expect(document.body.children).toHaveLength(0);
});

it("clears private cached feedback and identity immediately on another tab's logout", async () => {
  const { CommentsApi } = await import("../src/api");
  const config = { ...options, onboarding: undefined };
  const api = new CommentsApi(config);
  api.save({
    token: "private-session",
    user: { id: "reviewer", name: "Private Reviewer", verified: true },
  });
  localStorage.setItem(
    `${api.sessionKey}:${JSON.stringify([config.repo, "local"])}:threads`,
    JSON.stringify({
      token: api.token,
      threads: [
        {
          id: "private",
          page: "/",
          resolved: false,
          resolvedBy: null,
          createdAt: 1,
          updatedAt: 1,
          anchor: {
            selector: "body",
            text: "",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            pageX: 0,
            pageY: 0,
            viewportWidth: 1200,
          },
          comments: [
            {
              id: "comment",
              body: "Private feedback",
              author: api.user,
              createdAt: 1,
              editedAt: null,
              reactions: {},
            },
          ],
        },
      ],
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  controller = initComments(config);
  controller.open();
  const shadow = [...document.body.children].find(
    (node) => node.shadowRoot,
  )!.shadowRoot!;
  expect(shadow.textContent).toContain("Private feedback");
  expect(
    shadow.querySelector('[aria-label="Private Reviewer · Account"]'),
  ).not.toBeNull();
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "another-project",
      storageArea: localStorage,
    }),
  );
  expect(shadow.textContent).toContain("Private feedback");
  api.clear(); // The other tab removes both its session and account snapshot.
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: api.sessionKey,
      newValue: null,
      storageArea: localStorage,
    }),
  );
  expect(shadow.textContent).not.toContain("Private feedback");
  expect(
    shadow.querySelector('[aria-label="Private Reviewer · Account"]'),
  ).toBeNull();
  expect(shadow.querySelector('[aria-label="Enter your name"]')).not.toBeNull();
  api.save({
    token: "another-session",
    user: { id: "other", name: "Other Reviewer", verified: true },
  });
  window.dispatchEvent(new Event("focus"));
  expect(
    shadow.querySelector('[aria-label="Other Reviewer · Account"]'),
  ).not.toBeNull();
  expect(shadow.textContent).not.toContain("Private feedback");
  localStorage.clear();
});

it("keeps multi-root host layout and framework-owned nodes untouched", () => {
  const main = document.createElement("main");
  const aside = document.createElement("aside");
  document.body.append(main, aside);
  document.body.style.display = "grid";
  controller = initComments({ ...options, sidebar: "background" });
  const host = [...document.body.children].find(
    (node) => node.shadowRoot,
  )! as HTMLElement;
  expect(document.querySelector("body > main")).toBe(main);
  expect(document.querySelector("body > aside")).toBe(aside);
  expect(host.dataset.sidebar).toBe("edge");
  document.body.style.background = "blue";
  controller.close();
  controller.destroy();
  expect([...document.body.children]).toEqual([main, aside]);
  expect(document.body.style.display).toBe("grid");
  expect(document.body.style.background).toBe("blue");
  document.body.removeChild(main); // Framework ownership still matches the mounted tree.
  document.body.style.cssText = "";
});

it("frames an existing sole app root without reparenting it", () => {
  const app = document.createElement("main");
  document.body.append(app, document.createElement("script"));
  controller = initComments({ ...options, sidebar: "background" });
  expect(app.parentElement).toBe(document.body);
  expect(app.style.boxSizing).toBe("border-box");
  const host = [...document.body.children].find(
    (node) => node.shadowRoot,
  )! as HTMLElement;
  expect(host.dataset.sidebar).toBe("background");
  controller.destroy();
  expect(app.parentElement).toBe(document.body);
  expect(app.style.transform).toBe("");
  expect(app.style.boxSizing).toBe("");
  document.body.append(document.createElement("aside"));
  controller = initComments({
    ...options,
    sidebar: "background",
    pageRoot: app,
  });
  expect(app.parentElement).toBe(document.body);
  expect(
    (
      [...document.body.children].find(
        (node) => node.shadowRoot,
      )! as HTMLElement
    ).dataset.sidebar,
  ).toBe("background");
});

it("rejects unsafe page roots before mounting", () => {
  for (const pageRoot of [
    document.body,
    document.documentElement,
    document.createElement("main"),
  ])
    expect(() => initComments({ ...options, pageRoot })).toThrow(
      "pageRoot must",
    );
  expect([...document.body.children].some((node) => node.shadowRoot)).toBe(
    false,
  );
});

it("uses Floating for boxless content roots even when explicitly configured", () => {
  const app = document.createElement("main");
  app.style.display = "contents";
  document.body.append(app);
  controller = initComments({ ...options, sidebar: "background" });
  expect(
    (
      [...document.body.children].find(
        (node) => node.shadowRoot,
      )! as HTMLElement
    ).dataset.sidebar,
  ).toBe("edge");
  expect(app.style.display).toBe("contents");
  controller.destroy();
  controller = initComments({
    ...options,
    sidebar: "background",
    pageRoot: app,
  });
  expect(
    (
      [...document.body.children].find(
        (node) => node.shadowRoot,
      )! as HTMLElement
    ).dataset.sidebar,
  ).toBe("edge");
});
