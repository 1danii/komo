// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { githubIssueAction } from "../src/github-issue-dialog";
import type { CommentsApi } from "../src/api";
import type { Thread } from "../src/types";

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1024);
  vi.stubGlobal("innerHeight", 768);
  HTMLElement.prototype.showPopover = function () {};
  HTMLElement.prototype.hidePopover = function () {
    this.remove();
  };
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const thread = {
  id: "one",
  comments: [{ body: "Button is broken\nDetails" }],
} as Thread;
it("reuses the popover, retains title on failure, and refreshes only after successful conversion", async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("GitHub unavailable"))
    .mockResolvedValueOnce({ url: "https://github.com/owner/repo/issues/1" });
  const api = {
    token: "session",
    request,
    githubRepository: "owner/repo",
  } as unknown as CommentsApi;
  const controls = document.createElement("div");
  document.body.append(controls);
  const refresh = vi.fn().mockResolvedValue(undefined);
  await githubIssueAction(api, thread, controls, refresh);
  controls.querySelector("button")!.click();
  const form = controls.querySelector("form")!;
  expect(form.className).toBe("cleanup-confirm");
  const input = form.querySelector("input")!;
  expect(input.value).toBe("");
  input.value = "Chosen title";
  form.dispatchEvent(new Event("submit", { cancelable: true }));
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(submit.disabled).toBe(true);
  expect(submit.hasAttribute("data-loading")).toBe(true);
  await vi.waitFor(() =>
    expect(form.textContent).toContain("GitHub unavailable"),
  );
  expect(input.value).toBe("Chosen title");
  expect(submit.disabled).toBe(false);
  expect(submit.hasAttribute("data-loading")).toBe(false);
  expect(refresh).not.toHaveBeenCalled();
  form.dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(request).toHaveBeenLastCalledWith("threads/one/github-issue", "POST", {
    title: "Chosen title",
  });
});
it("does not show conversion for visitors", async () => {
  const controls = document.createElement("div");
  document.body.append(controls);
  await githubIssueAction(
    { token: "x", request: vi.fn() } as unknown as CommentsApi,
    thread,
    controls,
    vi.fn(),
  );
  expect(controls.children).toHaveLength(0);
});
