import { button, el } from "./dom.js";

/** Shared confirmation surface and cancel action for thread popovers. */
export function confirmationPopover(trigger: HTMLElement, title: string) {
  const prompt = el("form", "cleanup-confirm");
  prompt.popover = "auto";
  prompt.setAttribute("role", "dialog");
  prompt.setAttribute("aria-label", title);
  prompt.append(el("strong", "", title));
  const close = () => {
    prompt.hidePopover();
    trigger.focus({ preventScroll: true });
  };
  const actions = el("div", "cleanup-actions");
  actions.append(button("Cancel", close, "secondary"));
  return { prompt, actions, close };
}

/** Position a native confirmation popover at its trigger and clean up on dismissal. */
export function showConfirmationPopover(
  prompt: HTMLElement,
  trigger: HTMLElement,
) {
  prompt.addEventListener("toggle", () => {
    if (!prompt.matches(":popover-open")) prompt.remove();
  });
  prompt.showPopover();
  const rect = trigger.getBoundingClientRect();
  prompt.style.left = `${Math.max(12, Math.min(rect.right - prompt.offsetWidth, innerWidth - prompt.offsetWidth - 12))}px`;
  prompt.style.top = `${Math.max(12, Math.min(rect.bottom + 8, innerHeight - prompt.offsetHeight - 12))}px`;
}
