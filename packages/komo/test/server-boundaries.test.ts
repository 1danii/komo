import { afterEach, expect, it, vi } from "vitest";
import { siteEdits, editedOrigins } from "../server/project-sites";
import worker from "../server/index";
import type { KomoBackendEnv } from "../server/database-adapter";
vi.mock("../server/setup-client.txt", () => ({ default: "" }));
afterEach(() => vi.restoreAllMocks());
const environment = (all: ReturnType<typeof vi.fn>) =>
  ({
    PROJECTS: JSON.stringify({
      test: { repo: "owner/site", origins: ["https://revoked.example"] },
    }),
    DB: {
      dialect: "sqlite",
      operations: {
        projectSiteEdits: () => ({ execute: all }),
        legacySiteEdits: () => ({ execute: all }),
      },
    },
  }) as unknown as KomoBackendEnv;
it("never restores revoked origins on operational database failures", async () => {
  const all = vi.fn().mockRejectedValueOnce(new Error("D1_ERROR: database is locked"))
    .mockResolvedValue({results: [{origin: "https://revoked.example", removed: 1}]});
  const env = environment(all);
  await expect(siteEdits(env, "test")).rejects.toThrow("database is locked");
  expect(all).toHaveBeenCalledTimes(1);
  const edits = await siteEdits(env, "test");
  expect(editedOrigins(["https://revoked.example"], edits)).toEqual([]);
});
it("supports only recognized missing legacy schema and propagates fallback failures", async () => {
  const all = vi.fn().mockRejectedValueOnce(new Error("D1_ERROR: no such column: removed at offset 14: SQLITE_ERROR"))
    .mockResolvedValueOnce({results: [{origin: "https://added.example"}]});
  const env = environment(all);
  expect(await siteEdits(env, "test")).toEqual({added: ["https://added.example"], removed: []});
  all.mockRejectedValueOnce(new Error("D1_ERROR: no such table: project_sites: SQLITE_ERROR"));
  expect(await siteEdits(env, "test")).toEqual({added: [], removed: []});
  all.mockRejectedValueOnce(new Error("no such column: removed"))
    .mockRejectedValueOnce(new Error("database unavailable"));
  await expect(siteEdits(env, "test")).rejects.toThrow("database unavailable");
  all.mockRejectedValueOnce(new Error("no such column: unrelated"));
  await expect(siteEdits(env, "test")).rejects.toThrow("unrelated");
});
it("returns a non-cacheable failure without CORS when site policy cannot be read", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const env = environment(vi.fn().mockRejectedValue(new Error("database unavailable")));
  const response = await worker.fetch(new Request("https://api.example/config?project=test", {
    headers: {Origin: "https://revoked.example"},
  }), env, {waitUntil: vi.fn()} as unknown as ExecutionContext);
  expect(response.status).toBe(500);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  expect(await response.text()).not.toContain("database unavailable");
});
