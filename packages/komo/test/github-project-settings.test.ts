// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { githubProjectSettings } from "../src/github-project-settings";
import type { OnboardingOptions } from "../src/types";

type Request = Parameters<NonNullable<OnboardingOptions["integrations"]>>[0];
const connected = {
  configured: true,
  connection: { login: "octocat" },
  repository: null,
  repositories: [{ id: "101", name: "octocat/demo" }],
  available: true,
};
const selected = { repository: { id: "101", name: "octocat/demo" } };
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
const click = (label: string) => {
  const target = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === label,
  );
  expect(target, label).toBeDefined();
  target!.click();
};
it("enables and saves immediately when a repository is selected", async () => {
  const request = vi.fn().mockResolvedValue(connected);
  document.body.append(githubProjectSettings(request as Request));
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain("Select repository"),
  );
  expect(document.body.textContent).not.toContain("Connect GitHub");
  expect(request).not.toHaveBeenCalledWith(
    "/github",
    "PATCH",
    expect.anything(),
  );
  expect(document.body.textContent).toContain("Connected as @octocat");
  click("octocat/demo");
  await vi.waitFor(() =>
    expect(request).toHaveBeenCalledWith("/github", "PATCH", {
      repositoryId: "101",
    }),
  );
});
it("disconnects this project after access loss without confirmation", async () => {
  const request = vi.fn().mockResolvedValue({
    ...connected,
    ...selected,
    repositories: [],
    available: false,
    error: "This GitHub installation is suspended.",
  });
  document.body.append(githubProjectSettings(request as Request));
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain(
      "octocat/demo is unavailable",
    ),
  );
  expect(document.body.textContent).toContain("suspended");
  click("Disconnect");
  await vi.waitFor(() =>
    expect(request).toHaveBeenCalledWith("/github", "DELETE"),
  );
});
it("explains an automatic disconnection after the App was uninstalled", async () => {
  const request = vi.fn().mockResolvedValue({
    ...connected,
    connection: null,
    repositories: [],
    removed: true,
  });
  document.body.append(githubProjectSettings(request as Request));
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain("GitHub access was removed."),
  );
  expect(document.body.textContent).toContain("Connect GitHub");
  expect(document.body.textContent).not.toContain("Manage access");
});
it("keeps an unconfigured App distinct from a disconnected account", async () => {
  document.body.append(
    githubProjectSettings(
      vi.fn().mockResolvedValue({ configured: false }) as Request,
    ),
  );
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain("not configured"),
  );
  expect(document.body.textContent).not.toContain("Connect GitHub");
});

it("connects and manages access in one popup, reloading when it closes", async () => {
  const popup = { closed: false, close: vi.fn(), location: { href: "" } };
  vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  const request = vi
    .fn()
    .mockResolvedValueOnce({ ...connected, connection: null })
    .mockResolvedValueOnce({ url: "http://localhost:8788/auth/github-app/authorize?state=x" })
    .mockResolvedValue({ ...connected, repositories: [] });
  const panel = githubProjectSettings(request as Request);
  document.body.append(panel);
  await vi.waitFor(() => expect(panel.textContent).toContain("Connect GitHub"));
  expect(panel.querySelector('[aria-label="GitHub repository"]')).toBeNull();
  click("Connect GitHub");
  await vi.waitFor(() => expect(popup.location.href).toContain("state=x"));
  expect(request).toHaveBeenCalledWith("/github/connect", "POST", {
    install: false,
  });
  popup.closed = true;
  await vi.waitFor(() =>
    expect(panel.textContent).toContain("Manage access"),
  );
  expect(panel.className).toBe("account-name-label");
  expect(
    panel.querySelector('[aria-label="GitHub repository"]'),
  ).not.toBeNull();
  popup.closed = false;
  click("Manage access");
  await vi.waitFor(() =>
    expect(request).toHaveBeenCalledWith("/github/connect", "POST", {
      install: true,
    }),
  );
});

it("updates immediately while saving without refetching GitHub settings", async () => {
  let finishSave!: () => void;
  const saved = new Promise<void>((resolve) => {
    finishSave = resolve;
  });
  const request = vi
    .fn()
    .mockImplementation((_path, method) =>
      method === "PATCH" ? saved : Promise.resolve(connected),
    );
  const panel = githubProjectSettings(request as Request);
  document.body.append(panel);
  await vi.waitFor(() =>
    expect(panel.querySelector(".selection-label")?.textContent).toBe(
      "Select repository",
    ),
  );
  click("octocat/demo");
  expect(panel.querySelector(".selection-label")?.textContent).toBe(
    "octocat/demo",
  );
  expect(panel.getAttribute("aria-busy")).toBe("true");
  finishSave();
  await vi.waitFor(() =>
    expect(panel.textContent).toContain("Repository updated."),
  );
  expect(request.mock.calls.filter(([, method]) => !method)).toHaveLength(1);
});

it("restores the previous repository when saving fails", async () => {
  const request = vi.fn().mockImplementation((_path, method) =>
    method === "PATCH"
      ? Promise.reject(new Error("Repository access was removed."))
      : Promise.resolve({
          ...connected,
          ...selected,
          repositories: [
            ...connected.repositories,
            { id: "102", name: "octocat/other" },
          ],
        }),
  );
  const panel = githubProjectSettings(request as Request);
  document.body.append(panel);
  await vi.waitFor(() =>
    expect(panel.querySelector(".selection-label")?.textContent).toBe(
      "octocat/demo",
    ),
  );
  click("octocat/other");
  expect(panel.querySelector(".selection-label")?.textContent).toBe(
    "octocat/other",
  );
  await vi.waitFor(() =>
    expect(panel.textContent).toContain("Repository access was removed."),
  );
  expect(panel.querySelector(".selection-label")?.textContent).toBe(
    "octocat/demo",
  );
});

it.each([false, true])(
  "saves the latest choice after an in-flight save (failure: %s)",
  async (failFirst) => {
    let finish!: () => void;
    const firstSave = new Promise<void>((resolve, reject) => {
      finish = () =>
        failFirst ? reject(new Error("Temporary failure")) : resolve();
    });
    let saves = 0;
    const request = vi.fn().mockImplementation((_path, method) => {
      if (method === "PATCH")
        return ++saves === 1 ? firstSave : Promise.resolve({ ok: true });
      return Promise.resolve({
        ...connected,
        repositories: [
          ...connected.repositories,
          { id: "102", name: "octocat/other" },
        ],
      });
    });
    const panel = githubProjectSettings(request as Request);
    document.body.append(panel);
    await vi.waitFor(() =>
      expect(panel.textContent).toContain("Select repository"),
    );
    click("octocat/demo");
    click("octocat/other");
    expect(panel.querySelector(".selection-label")?.textContent).toBe(
      "octocat/other",
    );
    expect(saves).toBe(1);
    finish();
    await vi.waitFor(() => expect(panel.getAttribute("aria-busy")).toBeNull());
    expect(
      request.mock.calls
        .filter(([, method]) => method === "PATCH")
        .map(([, , body]) => body.repositoryId),
    ).toEqual(["101", "102"]);
    expect(panel.querySelector(".selection-label")?.textContent).toBe(
      "octocat/other",
    );
    expect(panel.textContent).not.toContain("Temporary failure");
  },
);

it("saves a return to the original repository even if the first response is lost", async () => {
  let fail!: () => void;
  const saving = new Promise<void>((_resolve, reject) => {
    fail = () => reject(new Error("Response lost"));
  });
  let saves = 0;
  const request = vi.fn().mockImplementation((_path, method) =>
    method === "PATCH"
      ? ++saves === 1
        ? saving
        : Promise.resolve({ ok: true })
      : Promise.resolve({
          ...connected,
          ...selected,
          repositories: [
            ...connected.repositories,
            { id: "102", name: "octocat/other" },
          ],
        }),
  );
  const panel = githubProjectSettings(request as Request);
  document.body.append(panel);
  await vi.waitFor(() =>
    expect(panel.querySelector(".selection-label")?.textContent).toBe(
      "octocat/demo",
    ),
  );
  click("octocat/other");
  click("octocat/demo");
  fail();
  await vi.waitFor(() => expect(panel.getAttribute("aria-busy")).toBeNull());
  expect(
    request.mock.calls
      .filter(([, method]) => method === "PATCH")
      .map(([, , body]) => body.repositoryId),
  ).toEqual(["102", "101"]);
});
