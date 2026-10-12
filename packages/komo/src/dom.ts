import { applyAccent } from "./accent.js";
import type { Identity } from "./types.js";
import { iconMarkup as icons } from "./icon-markup.js";
export { icons };
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const iconTemplates = new Map<keyof typeof icons, SVGSVGElement>();
/** Mark a pending button action separately from an unavailable control. */
export function setButtonBusy(button: HTMLButtonElement, busy = true) {
  button.toggleAttribute("data-loading", busy);
  return button.disabled = busy;
}
export function icon(name: keyof typeof icons): SVGSVGElement {
  let template = iconTemplates.get(name);
  if (!template) {
    const container = document.createElement("div");
    container.innerHTML = icons[name];
    template = container.querySelector("svg")!;
    iconTemplates.set(name, template);
  }
  return template.cloneNode(true) as SVGSVGElement;
}
export function button(
  label: string,
  action: () => void,
  className = "icon",
  glyph?: keyof typeof icons,
) {
  const node = el("button", className);
  node.type = "button";
  node.title = label;
  node.setAttribute("aria-label", label);
  if (glyph) node.append(icon(glyph));
  else node.textContent = label;
  node.addEventListener("click", action);
  return node;
}
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
export function age(time: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (!minutes) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function avatar(user: Identity) {
  const node = el("span", "avatar", initials(user.name));
  applyAccent(node, user.accentColor);
  if (
    user.avatarUrl &&
    /^(https:\/\/|data:image\/jpeg;base64,)/.test(user.avatarUrl)
  ) {
    const image = el("img");
    image.src = user.avatarUrl;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove(), { once: true });
    node.append(image);
  }
  return node;
}

// Google Identity branding asset: https://developers.google.com/identity/branding-guidelines
export function googleLogo() {
  const image = el("img", "google-logo");
  image.src =
    "data:image/webp;base64,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";
  image.alt = "";
  image.width = image.height = 18;
  return image;
}
