import { button, el, setButtonBusy } from "./dom.js";
import { selectionMenu } from "./action-menu.js";
import type { OnboardingOptions } from "./types.js";

type GithubSettings = {
  configured: boolean;
  connection: { login: string } | null;
  repository: { id: string; name: string } | null;
  repositories: { id: string; name: string }[];
  available?: boolean;
  /** GitHub no longer has an installation this project used. */
  removed?: boolean;
  error?: string;
};

/** Owner-only GitHub controls are bundled exclusively into the standalone admin screen. */
export const githubProjectSettings: NonNullable<
  OnboardingOptions["integrations"]
> = (request) => {
  const panel = el("section", "account-name-label");
  panel.setAttribute("aria-label", "GitHub");
  const content = el("div", "account-name-label");
  const status = el("p", "account-usage-status");
  status.setAttribute("role", "status");
  panel.append(el("span", "", "GitHub"), content, status);
  let busy = false;
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    busy = true;
    panel.setAttribute("aria-busy", "true");
    const controls = [
      ...content.querySelectorAll<HTMLButtonElement>("button"),
    ].filter((item) => !item.disabled);
    controls.forEach((item) => {
      setButtonBusy(item);
    });
    status.textContent = "";
    try {
      await work();
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Try again.";
    } finally {
      busy = false;
      panel.removeAttribute("aria-busy");
      controls.forEach((item) => {
        setButtonBusy(item, false);
      });
    }
  };
  /** Authorizing and installing happen in one popup; closing it simply reloads access. */
  const connect = (install: boolean) => {
    if (busy) return;
    const popup = window.open(
      "about:blank",
      "komo-github-app",
      "popup,width=600,height=720",
    );
    if (!popup) {
      status.textContent = "Allow popups to connect GitHub.";
      return;
    }
    void run(async () => {
      try {
        const start = await request<{ url: string }>(
          "/github/connect",
          "POST",
          { install },
        );
        const origin = new URL(start.url).origin;
        await new Promise<void>((resolve, reject) => {
          const finish = (error?: string) => {
            window.removeEventListener("message", listen);
            clearInterval(poll);
            if (error) reject(new Error(error));
            else resolve();
          };
          const listen = (event: MessageEvent) => {
            if (
              event.source !== popup ||
              event.origin !== origin ||
              event.data?.type !== "komo:github-connected"
            )
              return;
            finish(
              typeof event.data.error === "string"
                ? event.data.error
                : undefined,
            );
          };
          const poll = window.setInterval(() => {
            if (popup.closed || !panel.isConnected) finish();
          }, 500);
          window.addEventListener("message", listen);
          popup.location.href = start.url;
        });
      } finally {
        popup.close();
      }
      await load();
    });
  };
  const load = async () => {
    const data = await request<GithubSettings>("/github");
    content.replaceChildren();
    status.textContent = data.error ?? "";
    if (!data.configured) {
      content.append(
        el(
          "p",
          "account-usage-note",
          "GitHub App is not configured on this server.",
        ),
      );
      return;
    }
    if (!data.connection) {
      if (data.removed)
        content.append(
          el("p", "account-usage-note", "GitHub access was removed."),
        );
      content.append(
        button("Connect GitHub", () => connect(false), "secondary"),
      );
      return;
    }
    content.append(
      el("p", "account-usage-note", `Connected as @${data.connection.login}`),
    );
    const unavailable =
      data.repository && !data.available
        ? el(
            "p",
            "account-usage-note",
            `${data.repository.name} is unavailable. Restore access or choose another repository.`,
          )
        : null;
    if (unavailable) content.append(unavailable);
    const label = el("div", "account-name-label", "Repository");
    if (!data.repositories.length) {
      const placeholder = el("input");
      placeholder.value = "No repositories available";
      placeholder.disabled = true;
      placeholder.setAttribute("aria-label", "GitHub repository");
      label.append(placeholder);
    } else {
      let selected =
        data.repository &&
        data.repositories.some((item) => item.id === data.repository!.id)
          ? data.repository.id
          : "";
      let savedRepository = selected;
      let savingRepository = false;
      let menu: HTMLElement;
      const drawRepository = () => {
        const next = selectionMenu(
          "GitHub repository",
          data.repositories.map((item) => [item.id, item.name]),
          selected,
          (value) => {
            if (busy) {
              if (savingRepository) {
                selected = value;
                drawRepository();
              }
              return;
            }
            void run(async () => {
              savingRepository = true;
              selected = value;
              drawRepository();
              try {
                for (;;) {
                  const repositoryId = selected;
                  try {
                    await request("/github", "PATCH", { repositoryId });
                    savedRepository = repositoryId;
                  } catch (error) {
                    if (selected !== repositoryId) continue;
                    selected = savedRepository;
                    drawRepository();
                    throw error;
                  }
                  if (selected === savedRepository) break;
                }
                unavailable?.remove();
                status.textContent = "Repository updated.";
              } finally {
                savingRepository = false;
              }
            });
          },
        );
        if (!selected)
          next.querySelector(".selection-label")!.textContent =
            "Select repository";
        if (menu) menu.replaceWith(next);
        else label.append(next);
        menu = next;
      };
      drawRepository();
    }
    content.append(
      label,
      button("Manage access", () => connect(true), "secondary"),
      button(
        "Disconnect",
        () =>
          void run(async () => {
            await request("/github", "DELETE");
            await load();
          }),
        "secondary",
      ),
    );
  };
  void run(load);
  return panel;
};
