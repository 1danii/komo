import type { CommentsApi } from "./api.js";
import type { OnboardingOptions } from "./types.js";
import { accountUsage } from "./account-usage.js";

// One lazy chunk serves every account dialog panel.
export { accountUsage };
export { projectManagement } from "./project-management.js";
import { button, el, icon, setButtonBusy } from "./dom.js";

export function onboardingPanel(api: CommentsApi, options: OnboardingOptions) {
  const panel = el("section", "onboarding-panel");
  const status = el("p", "account-usage-status");
  status.setAttribute("role", "status");
  const fail = (error: unknown) => {
    status.textContent = error instanceof Error ? error.message : "Try again.";
  };
  const showWorkspace = async () => {
    const workspace = encodeURIComponent(options.workspace!);
    const sitePlaceholder = el("div", "account-sites");
    const siteHeading = el("div", "account-sites-summary");
    siteHeading.append(el("span", "", "Approved sites"), icon("chevron"));
    sitePlaceholder.append(siteHeading);
    sitePlaceholder.setAttribute("aria-busy", "true");
    status.textContent = "";
    panel.replaceChildren(
      accountUsage(api, `usage?workspace=${workspace}`, false),
      sitePlaceholder,
      status
    );
    try {
      const result = await api.request<{
        sites: string[];
        suggested: string[];
      }>(`workspace?workspace=${workspace}`);
      if (!panel.isConnected) return;
      status.textContent = "";
      const sites = el("section", "account-sites");
      sites.dataset.open = "false";
      const summary = button(
        "",
        () => {
          const open = sites.dataset.open !== "true";
          sites.dataset.open = String(open);
          summary.setAttribute("aria-expanded", String(open));
          reveal.inert = !open;
          reveal.setAttribute("aria-hidden", String(!open));
        },
        "account-sites-summary"
      );
      summary.setAttribute("aria-expanded", "false");
      const reveal = el("div", "account-sites-reveal");
      reveal.id = `approved-sites-${crypto.randomUUID()}`;
      reveal.inert = true;
      reveal.setAttribute("aria-hidden", "true");
      summary.setAttribute("aria-controls", reveal.id);
      const clip = el("div", "account-sites-clip");
      const siteCount = el("span", "account-sites-count");
      summary.append(
        el("span", "", "Approved sites"),
        siteCount,
        icon("chevron")
      );
      const siteContent = el("div", "account-sites-content");
      const list = el("div", "approved-sites");
      const renderSites = () => {
        siteCount.textContent = String(result.sites.length);
        list.replaceChildren(
          ...result.sites.map((site) => el("span", "", new URL(site).host))
        );
      };
      renderSites();
      const label = el("label", "account-name-label", "Website");
      const input = el("input");
      input.type = "url";
      input.placeholder = "https://your-site.com";
      input.setAttribute("autocomplete", "url");
      input.value =
        options.site ||
        result.suggested.find((site) => !result.sites.includes(site)) ||
        "";
      label.append(input);
      const approve = button(
        "Approve site",
        async () => {
          let origin: string;
          try {
            const url = new URL(input.value.trim());
            if (url.protocol !== "https:" || url.username || url.password)
              throw Error("Enter an HTTPS website address.");
            origin = url.origin;
          } catch (error) {
            fail(error);
            return;
          }
          const previous = [...result.sites];
          const typed = input.value;
          if (!result.sites.includes(origin)) result.sites.push(origin);
          renderSites();
          input.value = "";
          setButtonBusy(approve);
          try {
            await api.request("workspace/sites", "POST", {
              project: options.workspace,
              origin,
            });

            options.site = undefined;
            status.textContent = "Site approved";
          } catch (error) {
            result.sites = previous;
            renderSites();
            if (!input.value) input.value = typed;
            fail(error);
          } finally {
            setButtonBusy(approve, false);
          }
        },
        "secondary"
      );
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          approve.click();
        }
      });
      const note = el("div", "account-usage-note account-sites-note");
      note.append(
        icon("info"),
        el(
          "span",
          "",
          "Approved sites can show and share comments. Localhost comments are visible by default."
        )
      );
      siteContent.append(list, label, approve, note);
      clip.append(siteContent);
      reveal.append(clip);
      sites.append(summary, reveal);
      sitePlaceholder.replaceWith(sites);
    } catch (error) {
      fail(error);
      panel.append(button("Retry", () => void showWorkspace(), "secondary"));
    }
  };
  if (options.invite) {
    const join = button(
      "Accept invitation",
      async () => {
        setButtonBusy(join);
        try {
          await api.request("project/join", "POST", { invite: options.invite });
          options.invite = undefined;
          panel.replaceChildren(
            el("p", "", "You’re in. Return to the website to leave comments.")
          );
        } catch (error) {
          fail(error);
          setButtonBusy(join, false);
        }
      },
      "primary"
    );
    panel.append(join, status);
  } else if (options.workspace) void showWorkspace();
  else if (options.code || options.claimKey) {
    const create = button(
      options.code ? "Create project" : "Enable comments",
      async () => {
        setButtonBusy(create);
        const label = create.textContent;
        create.textContent = options.code
          ? "Creating project…"
          : "Enabling comments…";
        try {
          if (options.code) {
            const result = await api.request<{ project: string }>(
              "setup/complete",
              "POST",
              { code: options.code }
            );
            options.workspace = result.project;
            options.code = undefined;
            history.replaceState(
              null,
              "",
              `/setup?workspace=${encodeURIComponent(result.project)}`
            );
            await showWorkspace();
            status.textContent = "Project ready. Return to your terminal.";
          } else {
            await api.request("owner/claim", "POST", { key: options.claimKey });
            options.claimKey = undefined;
            panel.replaceChildren(accountUsage(api), status);
            status.textContent = "Comments are ready.";
          }
        } catch (error) {
          fail(error);
          setButtonBusy(create, false);
          create.textContent = label;
        }
      },
      "primary"
    );
    panel.append(create, status);
  } else {
    panel.append(accountUsage(api));
  }
  return panel;
}
