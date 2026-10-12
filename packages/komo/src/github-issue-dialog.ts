import { button, el, setButtonBusy } from "./dom.js";
import {
  showConfirmationPopover,
  confirmationPopover,
} from "./confirmation-popover.js";
import type { CommentsApi } from "./api.js";
import type { Thread } from "./types.js";

/** Reuse the confirmation popover surface for a member-only GitHub conversion form. */
export function githubIssueAction(
  api: CommentsApi,
  thread: Thread,
  controls: HTMLElement,
  refresh: () => Promise<unknown>,
) {
  const repository = api.githubRepository;
  if (!repository) return;
  const trigger = button(
    "Convert to GitHub issue",
    () => {
      const { prompt, actions, close } = confirmationPopover(
        trigger,
        "Convert to GitHub issue",
      );
      const title = el("input");
      title.maxLength = 256;
      title.required = true;
      const label = el("label", "account-name-label", "Issue title");
      label.append(title);
      const status = el("p");
      status.setAttribute("role", "status");
      const submit = el(
        "button",
        "primary",
        "Create issue",
      );
      submit.type = "submit";
      actions.append(submit);
      prompt.append(el("p", "", repository), label, status, actions);
      prompt.addEventListener("submit", async (event) => {
        event.preventDefault();
        const value = title.value.trim();
        if (submit.disabled || !value) return;
        title.disabled = setButtonBusy(submit);
        status.textContent = "";
        try {
          await api.request(`threads/${thread.id}/github-issue`, "POST", {
            title: value,
          });
          close();
          await refresh();
        } catch (error) {
          status.textContent =
            error instanceof Error ? error.message : "Try again.";
        } finally {
          title.disabled = setButtonBusy(submit, false);
        }
      });
      controls.append(prompt);
      showConfirmationPopover(prompt, trigger);
      title.focus();
    },
    "icon",
  );
  trigger.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 22v-4c-4 1-4-2-6-2m12 6v-4a3 3 0 0 0-1-2c4-.5 7-2 7-7a5 5 0 0 0-1-3c.5-2 0-3 0-3s-2 0-4 2a12 12 0 0 0-8 0C6 3 4 3 4 3s-.5 1 0 3a5 5 0 0 0-1 3c0 5 3 6.5 7 7a3 3 0 0 0-1 2"/></svg>';
  trigger.setAttribute("aria-haspopup", "dialog");
  // The caller appends Resolve immediately before adding this action.
  controls.insertBefore(trigger, controls.lastChild);
}
