import { morphingMenuStyles } from "./morphing-menu-styles.js";
export const styles: string = `
.project-management[hidden], .project-management [hidden] { display:none !important; }
.project-management .account-sites-summary { justify-content: space-between; }
.project-management .account-usage-status { padding: 0 16px; }
.project-management summary { cursor:pointer; }
.project-member { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; overflow-wrap:anywhere; }
.project-danger { display:grid; gap:10px; font-size:12px; }
.project-danger p { color:#999; line-height:1.5; }
/* <details> ignores grid gap, so space its actions directly. */
.project-danger > button { display:block; width:100%; margin-top:12px; }
.project-help { color:var(--accent,#c8b5f4); font-size:12px; }
.project-management .destructive { color:#fda29b; }

.cleanup-confirm { position:fixed; margin:0; width:min(296px,calc(100vw - 24px)); box-sizing:border-box; padding:16px; border:0; border-radius:16px; background:#242424; color:#eee; font:13px/1.5 ui-sans-serif,system-ui,sans-serif; box-shadow:inset 0 0 0 1px #ffffff18,0 12px 40px #0005; }
.cleanup-confirm p { margin:8px 0 16px; color:#aaa; }
.cleanup-actions { display:flex; justify-content:flex-end; gap:8px; }
.cleanup-actions button { border:0; border-radius:9px; padding:8px 10px; background:#ffffff0b; color:#ddd; font:inherit; cursor:pointer; }
.cleanup-actions button:hover { background:#ffffff15; }
.cleanup-actions button:focus-visible { outline:2px solid var(--accent,#c8b5f4); outline-offset:2px; }
.cleanup-actions .destructive, .panel-head .copy-page-prompt.destructive { color:#fda29b; }
.copy-page-prompt:disabled { opacity:.4; cursor:default; }
:host {
  all: initial;
  line-height: 1.45;
  color-scheme: light;
}
* {
  box-sizing: border-box;
}
button,
input,
textarea,
select {
  font: inherit;
  color: inherit;
}
button {
  appearance: none;
  border: 0;
  cursor: pointer;
  background: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex-shrink: 0;
}
button:disabled {
  opacity: 0.45;
  cursor: wait;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid #f48120;
  outline-offset: 3px;
}
input,
textarea,
select {
  border: 0;
  outline: none;
  background: #f4f3f0;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: inset 0 0 0 1px #e4e2dd;
}
input:focus,
textarea:focus,
select:focus {
  box-shadow: inset 0 0 0 2px #f48120;
}
textarea {
  resize: vertical;
  min-height: 85px;
  max-height: 260px;
  width: 100%;
  line-height: 1.55;
  scrollbar-width: none;
}
textarea::-webkit-scrollbar { display: none; }
input {
  min-width: 0;
  width: 100%;
}
p {
  margin: 0;
}
h2,
h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
a {
  color: inherit;
}
svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
small {
  font-size: 11px;
  color: #77766f;
}
.toolbar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  z-index: 5;
}

.catch {
  position: fixed;
  inset: 0;
  pointer-events: auto;
  cursor: crosshair;
  touch-action: none;
  z-index: 0;
}
.selection,
.area {
  position: fixed;
  pointer-events: none;
}
.selection {
  z-index: 1;
}
.pin {
  position: fixed;
  pointer-events: auto;
  z-index: 2;
}
.pin:hover,
.pin.active {
  background: #252522;
  color: #fff;
}
.pin.detached {
  opacity: 0.65;
}
.panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 380px;
  height: 100%;
  pointer-events: auto;
  background: #faf9f6;
  box-shadow:
    -1px 0 0 #dad8d1,
    -15px 0 40px #00000008;
  display: flex;
  flex-direction: column;
  z-index: 4;
}
.panel-head {
  display: grid;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.between {
  justify-content: space-between;
}
.muted {
  color: #77766f;
}
.icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
}
.icon:hover {
  background: #ebe9e3;
}
.list {
  overflow: auto;
  flex: 1;
  overscroll-behavior: contain;
  padding: 0 10px 100px;
}
.thread-card {
  display: block;
  width: 100%;
  text-align: left;
  position: relative;
}
.thread-card::after {
  content: "";
  position: absolute;
  bottom: 0;
  height: 1px;
  background: #e8e5de;
}
.thread-card:hover {
  background: #f0eee8;
}
.thread-item {
  position: relative;
}
.list[data-long] > .thread-item {
  content-visibility: auto;
  contain-intrinsic-block-size: auto 160px;
}
.thread-item > .card-resolve {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  opacity: 0;
  filter: blur(2px);
  transition:
    opacity 150ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.thread-item:hover > .card-resolve,
.thread-item > .card-resolve:focus-visible {
  opacity: 1;
  filter: none;
}
.thread-item > .card-resolve:active {
  transform: scale(0.98);
}
@media (hover: none) {
  .thread-item > .card-resolve {
    opacity: 1;
    filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .thread-item > .card-resolve {
    transition: none;
  }
}
.thread-card.active {
  background: #ede9df;
}
.thread-card .preview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: #77766f;
}
.page {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 215px;
}
.empty {
  text-align: center;
  color: #77766f;
  display: grid;
  justify-items: center;
}
.empty svg {
  width: 32px;
  height: 32px;
  color: #bbb6aa;
}
.empty strong {
  color: #34332e;
}
.empty p {
  max-width: 250px;
  line-height: 1.6;
}
.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.dialog {
  position: fixed;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 110px);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  z-index: 6;
}
.dialog-head {
  flex-shrink: 0;
}
.dialog-head h3 {
  font-size: 13px;
}
.messages {
  overflow: auto;
  overscroll-behavior: contain;
}
.message {
  position: relative;
}
.message + .message::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
}
.author {
  font-weight: 600;
  font-size: 12px;
}
.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  font-size: 10px;
}
.message-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.reaction {
  min-height: 25px;
}
.reaction-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 9px 0;
}
.composer {
  display: grid;
}
.primary {
  background: #282822;
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  min-height: 34px;
}
.primary:hover {
  background: #4a463a;
}
.secondary {
  padding: 8px 12px;
  border-radius: 8px;
  background: #eeece5;
  font-size: 12px;
  min-height: 34px;
}
.secondary:hover {
  background: #e4e0d6;
}
.notice {
  font-size: 11px;
  color: #777268;
  line-height: 1.5;
}
.error {
  background: #fff0e5;
  color: #9c4619;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
}
.toast {
  position: fixed;
  bottom: 94px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 16px;
  background: #242422;
  color: #fff;
  border-radius: 9px;
  max-width: 360px;
  pointer-events: auto;
  z-index: 10;
  font-size: 12px;
  box-shadow: 0 4px 20px #0002;
}
.account {
  display: grid;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
@media (max-width: 760px) {
  .toolbar {
    max-width: calc(100vw - 20px);
  }

}

${morphingMenuStyles}
.toolbar .morphing-menu {
  --mm-surface: #0d0d0d;
  --mm-ink: #f8f7f4;
  --mm-hover: #ffffff12;
}
.toolbar .morphing-menu__row {
  justify-content: flex-start;
}
.toolbar .morphing-menu__shortcut {
  padding: 0;
}
.toolbar .review-avatar {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 10px;
  letter-spacing: 0;
}

:host(.review-open) .panel {
  color: #eee;
  box-shadow: none;
}
:host(.review-open) .panel input,
:host(.review-open) .panel select {
  background: #191919;
  color: #ddd;
  box-shadow: inset 0 0 0 1px #ffffff12;
}
:host(.review-open) .panel .muted,
:host(.review-open) .panel small,
:host(.review-open) .panel .meta,
:host(.review-open) .panel .branch {
  color: #888;
}
:host(.review-open) .panel .filter {
  color: #999;
}
:host(.review-open) .panel .filter.active,
:host(.review-open) .panel .secondary {
  background: #262626;
  color: #eee;
}
:host(.review-open) .panel .icon:hover,
:host(.review-open) .panel .thread-card:hover {
  background: #161616;
}
:host(.review-open) .panel .empty .primary {
  background: var(--accent, #bda6ef);
  color: #211b2d;
  font-weight: 500;
}
:host(.review-open) .panel .empty strong {
  color: #aaa;
  font-weight: 400;
}
:host(.review-open) .panel .empty svg {
  color: #555;
}
:host(.review-open) .panel .list {
  padding-bottom: 24px;
}

:host {
  font-family:
    -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
  font-size: 13px;
  color: #202124;
}
.pin {
  width: 34px;
  height: 34px;
  border-radius: 50% 50% 50% 5px;
  font-size: 11px;
  font-weight: 600;
  box-shadow:
    0 0 0 2px #fff,
    0 3px 10px #0003;
}
.pin.active {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px #4388ff,
    0 4px 14px #0003;
}
.pin.resolved {
  background: #bfc9c4;
  color: #293c31;
}
.pin-check svg {
  width: 10px;
  height: 10px;
}
.pin-check {
  position: absolute;
  right: -4px;
  bottom: -3px;
  background: #fff;
  color: #4c6c56;
  border-radius: 50%;
  font-size: 9px;
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
}
.area,
.selection {
  background: #4285f410;
  box-shadow: inset 0 0 0 1.5px #4388ff;
  border-radius: 3px;
}
:host(.review-open) .panel {
  width: 380px;
  background: transparent;
}
.panel-head .row {
  gap: 4px;
}
:host(.review-open) .panel .icon {
  color: #909090;
  width: 28px;
  height: 28px;
}
.panel .icon svg {
  width: 16px;
  height: 16px;
}
.thread-card {
  border-radius: 14px;
}
.thread-card .preview {
  font-size: 15px;
  line-height: 1.5;
  margin: 0 0 14px;
  -webkit-line-clamp: 5;
  color: #f1f1f1;
  letter-spacing: -0.015em;
}
.thread-card .row {
  gap: 7px;
}
.thread-card .avatar {
  width: 20px;
  height: 20px;
  font-size: 8px;
}
.thread-card .author {
  font-size: 11px;
  font-weight: 500;
  color: #b2b2b2;
}
.thread-card small {
  margin-left: auto;
  font-size: 10px;
}
.thread-card .meta {
  margin-top: 7px;
  padding-left: 27px;
  font-size: 11px;
  gap: 8px;
}
.thread-card .meta:has(.page:empty) > :empty {
  display: none;
}
.thread-card .meta:has(.page:empty):has(span:last-child:empty) {
  display: none;
}
:host(.review-open) .panel .thread-card::after {
  left: 14px;
  right: 14px;
  background: #ffffff0c;
}
:host(.review-open) .panel .thread-card.active {
  background: #ffffff0a;
}
:host(.review-open) .panel .avatar {
  background: #bca8e7;
  color: #302342;
}
.empty {
  padding: 50px 16px;
  gap: 14px;
}
.empty svg {
  display: none;
}
.empty strong {
  font-size: 13px;
}
.dialog {
  overflow: hidden;
}
.dialog-head {
  position: absolute;
  z-index: 1;
  padding: 0;
  box-shadow: none;
  justify-content: flex-end;
  height: 26px;
}
.dialog-head .icon,
.draft-close,
.approved-site > .icon {
  width: 25px;
  height: 25px;
  color: #949494;
}
.dialog-head svg,
.draft-close svg,
.approved-site > .icon svg {
  width: 15px;
  height: 15px;
}
.draft-close {
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 1;
}
.messages {
  max-height: 45vh;
}
.message .author {
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.message .avatar {
  background: #c8b5f4;
  color: #352a50;
  font-size: 9px;
}
.message small {
  font-size: 10px;
}
.message-text {
  letter-spacing: -0.01em;
}
.actions {
  gap: 5px;
  min-height: 26px;
}
.actions > .icon {
  height: 24px;
  width: 24px;
}
.actions > .icon svg {
  height: 15px;
  width: 15px;
}
.reaction {
  padding: 3px 7px;
  border-radius: 20px;
  font-size: 11px;
}
.composer textarea {
  max-height: 180px;
  resize: none;
  outline: none;
}
.composer .row {
  gap: 8px;
}
.composer input {
  width: 130px;
  min-width: 0;
  background: #f5f5f7;
  box-shadow: none;
  padding: 7px 10px;
  border-radius: 20px;
  font-size: 12px;
}
.composer .row > .secondary {
  font-size: 10px;
  padding: 4px 8px;
  min-height: 28px;
}
.composer .avatar {
  width: 24px;
  height: 24px;
  font-size: 9px;
  background: #c8b5f4;
  color: #352a50;
}
.send {
  width: 30px;
  height: 30px;
  margin-left: auto;
  background: #3478f6;
  color: #fff;
  border-radius: 50%;
  padding: 0;
  transition:
    background 150ms ease,
    transform 150ms ease;
}
.send:disabled {
  opacity: 1;
  cursor: default;
}
.send svg {
  width: 18px;
  height: 18px;
}
.send:not(:disabled):active {
  transform: scale(0.94);
}
.toolbar .review-avatar {
  background: #ffffff16;
  color: #ddd;
}
.toolbar .review-avatar svg {
  width: 15px;
  height: 15px;
}
@media (max-width: 760px) {
  :host(.mobile-composing) .toolbar { opacity:0; pointer-events:none; visibility:hidden; }
  .dialog {
    width: calc(100vw - 32px);
    left: 16px !important;
    max-height: 65vh;
  }
  .dialog .messages {
    max-height: 35vh;
  }
}

.component-hover {
  position: fixed;
  pointer-events: none;
  z-index: 1;
  opacity: 0;
  background: #4388ff0b;
  box-shadow: inset 0 0 0 1.5px #4388ff;
  transition: opacity 100ms ease;
}

.composer {
  gap: 8px;
}
.composer textarea {
  min-height: 34px;
  font-size: 13px;
  line-height: 22px;
}
.composer:has(.avatar) {
  position: relative;
  padding-left: 42px;
  padding-right: 40px;
  min-height: 58px;
}
.composer:has(.avatar) > .row {
  display: contents;
}
.composer:has(.avatar) .avatar {
  position: absolute;
}
.composer:has(.avatar) .send {
  position: absolute;
  width: 26px;
  height: 26px;
}
.dialog:has(.draft-close) .composer {
  padding-top: 24px;
}
.message-text {
  font-size: 13px;
  line-height: 1.5;
}
.message:first-child > .row {
  padding-right: 78px;
}
.dialog-head {
  top: 12px;
  right: 8px;
}
.message .author {
  font-size: 11px;
}
.comment-menu {
  position: relative;
}
.comment-menu > summary {
  list-style: none;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.comment-menu > summary::-webkit-details-marker {
  display: none;
}
.comment-menu-items {
  position: absolute;
  top: 30px;
  right: 0;
}
.menu-action {
  width: 100%;
  text-align: left;
  background: transparent;
}
.pin-preview {
  position: fixed;
  pointer-events: auto;
  z-index: 3;
}
.pin-preview-open {
  display: block;
  width: 100%;
  background: transparent;
  color: inherit;
  text-align: left;
  border-radius: inherit;
}
.pin-preview p {
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pin-preview .avatar {
  background: #c8b5f4;
  color: #352a50;
}
.pin-preview small {
  color: #999;
  margin-left: auto;
}

/* Review workspace: shared gutters and a dock aligned to the comment column. */
:host(.review-open) .panel {
  top: 36px;
  right: 0;
  padding: 0 24px;
}
.panel-head {
  padding: 0 0 16px;
}
.thread-card {
  padding: 16px 12px;
}
.thread-card .preview {
  margin-bottom: 12px;
}
.thread-card::after {
  left: 12px;
  right: 12px;
}
:host(.review-open) .toolbar .morphing-menu {
  --mm-surface: #ffffff12;
  --mm-hover: #ffffff10;
}
.toolbar .morphing-menu__shell {
  backdrop-filter: blur(12px) saturate(1.2);
  box-shadow:
    inset 0 1px 0 #ffffff20,
    inset 0 0 0 1px #ffffff0c,
    0 4px 16px #0002;
}
.pin:hover {
  background: #bda6ef;
  color: #352a50;
  box-shadow:
    0 0 0 2px #fff,
    0 3px 10px #0003;
}

/* Charcoal action surfaces, with the same row rhythm as the review dock. */
.comment-menu-items {
  min-width: 224px;
  padding: 5px;
  border-radius: 12px;
  background: linear-gradient(145deg, #292729, #232323);
  color: #ededed;
  box-shadow:
    inset 0 0 0 1px #ffffff12,
    0 12px 32px #0004,
    0 2px 5px #0003;
}
.menu-action {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
  min-height: 36px;
  padding: 8px 10px;
  color: inherit;
  font-size: 13px;
  border-radius: 8px;
}
.menu-action svg {
  width: 16px;
  height: 16px;
  color: #bcb9bd;
}
.menu-action:hover,
.menu-action:focus-visible {
  background: #ffffff0d;
  outline: none;
}
.menu-action + .menu-action:last-child {
  margin-top: 6px;
  position: relative;
}
.menu-action + .menu-action:last-child::before {
  content: "";
  position: absolute;
  top: -4px;
  left: 5px;
  right: 5px;
  height: 1px;
  background: #ffffff0a;
}
.toolbar
  .morphing-menu:has(.morphing-menu__panel[aria-hidden="false"])
  .morphing-menu__shell {
  background: linear-gradient(145deg, #292729, #232323);
}
.toolbar .morphing-menu__row {
  gap: 10px;
  font-size: 13px;
  border-radius: 9px;
  color: #ededed;
}
.toolbar .morphing-menu__row svg {
  width: 18px;
  height: 18px;
  color: #bcb9bd;
}

/* Conversations keep an avatar column and a quiet, inset reply field. */
.dialog {
  width: 320px;
  border-radius: 16px;
}
.messages {
  padding: 0 16px;
}
.message {
  padding: 18px 0 16px;
}
.message .row {
  gap: 8px;
}
.message .avatar {
  width: 24px;
  height: 24px;
}
.message-text {
  padding-left: 32px;
  margin: 3px 0 8px;
}
.actions {
  padding-left: 32px;
}
.message + .message::before {
  left: -16px;
  right: -16px;
}
.composer {
  padding: 12px 16px;
}
.composer textarea {
  padding: 8px 10px;
  border-radius: 8px;
}
.composer:has(.avatar) {
  padding: 12px 16px 12px 48px;
}
.composer:has(.avatar) textarea {
  padding-right: 38px;
}
.composer:has(.avatar) .avatar {
  left: 16px;
  bottom: auto;
  top: 19px;
  width: 24px;
  height: 24px;
}
.composer:has(.avatar) .send {
  right: 22px;
  bottom: 18px;
}

/* Dark conversation surfaces. */
.review-avatar img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}
.dialog,
.pin-preview {
  background: #242424;
  color: #ececec;
  box-shadow:
    inset 0 0 0 1px #ffffff12,
    0 16px 48px #0005;
}
.message .author,
.pin-preview strong {
  color: #efefef;
}
.message small {
  color: #8d8d8d;
}
.message + .message::before,
.composer {
  box-shadow: 0 -1px 0 #ffffff08;
}
.message + .message::before {
  background: #ffffff08;
}
.dialog .icon,
.actions > .icon {
  color: #929292;
}
.dialog .icon:hover {
  background: #ffffff0a;
  color: #eee;
}
.composer textarea,
.dialog input,
.dialog textarea {
  background: #ffffff07;
  color: #eee;
  box-shadow: inset 0 0 0 1px #ffffff05;
}
.composer textarea::placeholder,
.dialog input::placeholder,
.dialog textarea::placeholder {
  color: #858585;
}
.composer textarea:focus,
.dialog textarea:focus {
  box-shadow: inset 0 0 0 1px #ffffff20;
}
.send:disabled {
  background: #ffffff0a;
  color: #707070;
}
.reaction {
  background: #ffffff08;
  color: #ccc;
}
.pin {
  touch-action: none;
}
.pin { padding: 0; overflow: hidden; }
.pin .avatar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  display: grid;
  place-items: center;
  font-size: inherit;
}
.avatar {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}
.sidebar-replies {
  position: relative;
  margin: 16px 0 0 9px;
  padding-left: 18px;
  display: grid;
  gap: 14px;
}
.sidebar-replies::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 8px;
  width: 1px;
  background: #ffffff16;
}
.sidebar-reply {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
}
.sidebar-reply > div {
  min-width: 0;
}
.sidebar-reply p {
  font-size: 13px;
  line-height: 1.5;
  margin-top: 4px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: #d9d9d9;
}
.reply-meta {
  font-size: 11px;
  color: #999;
}
.floating-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  width: max-content;
  max-width: min(360px, calc(100vw - 24px));
  padding: 10px 12px;
  border-radius: 12px;
  color: #d4d4d4;
  background: #292929;
  box-shadow:
    inset 0 0 0 1px #ffffff12,
    0 8px 28px #0004;
  font-size: 12px;
}
.floating-notice > svg {
  width: 16px;
  height: 16px;
  color: #aaa;
}
.floating-notice > span {
  flex: 1;
}
.floating-notice .icon {
  width: 24px;
  height: 24px;
}
.floating-notice .icon:hover {
  background: #ffffff10;
}
.notice-action {
  padding: 5px 8px;
  border-radius: 6px;
  background: #ffffff10;
}
.account-layer {
  position: fixed;
  inset: 0 0 0 auto;
  width: min(380px, 100vw);
  padding: 24px 16px 96px;
  z-index: 9;
  display: grid;
  place-items: center;
  background: #0008;
  pointer-events: auto;
}
.account-layer .account-dialog {
  position: relative;
  left: auto !important;
  top: auto !important;
  bottom: auto !important;
  width: 100%;
  max-height: calc(100dvh - 120px);
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
  scrollbar-width: thin;
  scrollbar-color: #ffffff30 transparent;
}
.account {
  padding: 36px 24px 24px;
  gap: 20px;
}
.account h2 {
  font-size: 20px;
  letter-spacing: -0.025em;
  font-weight: 500;
}
.account-name-label {
  display: grid;
  gap: 8px;
  font-size: 12px;
  color: #999;
}
.account input,
.account textarea {
  font-size: 15px;
  padding: 12px;
}
.account .primary {
  width: 100%;
  min-height: 42px;
  color: #222;
  background: #eee;
}
.account .primary:hover {
  background: white;
}
.account .secondary {
  background: #ffffff0a;
  color: #ddd;
}
.account > .avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  font-size: 18px;
}
.account .notice {
  color: #999;
}

.account-layer .account-dialog { border-radius: 24px; background: #202020; box-shadow: 0 16px 48px #0006, inset 0 0 0 1px #ffffff12; }
.account-layer .account { flex: none; padding: 32px 24px 24px; gap: 20px; }
.account-summary { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 8px; }
.account-summary .avatar { width: 72px; height: 72px; font-size: 24px; box-shadow: 0 0 0 4px #ffffff06; }
.account-summary h3 { margin: 6px 0 0; }
.account-status { display: flex; align-items: center; justify-content: center; gap: 5px; color: #949494; font-size: 12px; }
.account-layer .account input,
.account-layer .account textarea { width: 100%; min-height: 44px; background: #ffffff06; color: #f2f2f2; box-shadow: inset 0 0 0 1px #ffffff0b; border-radius: 12px; transition: box-shadow 150ms ease, background 150ms ease; }
.account-layer .account input:focus,
.account-layer .account textarea:focus { outline: none; background: #ffffff09; box-shadow: inset 0 0 0 1px #bda6ef; }
.account-layer .account button { border-radius: 12px; }
.account-layer .account .primary { background: #bda6ef; color: #211b2d; font-weight: 600; }
.account-layer .account .primary:disabled { opacity: .4; cursor: default; }
 .account-dialog .dialog-head { top: 16px; right: 14px; }
.account-layer .account .account-avatar-button { padding: 0; border-radius: 50%; background: transparent; position: relative; transition: filter 150ms ease, transform 150ms ease; }
.account-avatar-button:hover { filter: brightness(.88); transform: scale(1.025); }
.account-avatar-button:focus-visible { outline: 2px solid #bda6ef; outline-offset: 6px; }
.google-logo { width: 18px; height: 18px; flex: none; object-fit: contain; }
.account-status .google-logo { width: 14px; height: 14px; margin-left: 2px; }
.account .google-signin { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; width: 100%; box-shadow: inset 0 0 0 1px #ffffff12; }
.account-divider { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #777; }
.account-divider::before, .account-divider::after { content: ""; height: 1px; flex: 1; background: #ffffff0d; }
@media (prefers-reduced-motion: reduce) { .account-avatar-button { transition: none !important; } }
.account-session { padding-top: 20px; box-shadow: 0 -1px #ffffff0b; }
.account-session .secondary { width: 100%; min-height: 40px; }
.account-setting { display: grid; gap: 8px; }
.account-setting-label { font-size: 11px; line-height: 16px; color: #a5a5a5; text-transform: uppercase; letter-spacing: .05em; }
.account .selection-menu > summary.selection-trigger {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px 10px 12px;
  justify-content: space-between;
  border-radius: 12px;
  background: #ffffff0a;
  color: inherit;
  font: inherit;
  box-shadow: inset 0 0 0 1px #ffffff14;
}
.selection-trigger:focus-visible { outline: 2px solid var(--accent, #bda6ef); outline-offset: 2px; }
.account .selection-menu { min-width: 0; }
.account .selection-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 760px) { .account-layer { width: 100%; } }

:host {
  --duration-stagger: 40ms;
  --duration-fast: 250ms;
  --duration-quick: 150ms;
  --ease-smooth-out: cubic-bezier(0.22, 1, 0.36, 1);
  --dropdown-open-dur: var(--duration-fast);
  --dropdown-close-dur: var(--duration-quick);
  --dropdown-pre-scale: 0.97;
  --dropdown-closing-scale: 0.99;
  --dropdown-ease: var(--ease-smooth-out);
}
.t-dropdown {
  transform-origin: top left;
  transform: scale(var(--dropdown-pre-scale));
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--dropdown-open-dur) var(--dropdown-ease),
    opacity var(--dropdown-open-dur) var(--dropdown-ease);
  will-change: transform, opacity;
}
.t-dropdown[data-origin="top-right"] {
  transform-origin: top right;
}
.t-dropdown[data-origin="top-center"] {
  transform-origin: top center;
}
.t-dropdown[data-origin="bottom-left"] {
  transform-origin: bottom left;
}
.t-dropdown[data-origin="bottom-center"] {
  transform-origin: bottom center;
}
.t-dropdown[data-origin="bottom-right"] {
  transform-origin: bottom right;
}

.t-dropdown.is-open {
  transform: scale(1);
  opacity: 1;
  pointer-events: auto;
}
.t-dropdown.is-closing {
  transform: scale(var(--dropdown-closing-scale));
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--dropdown-close-dur) var(--dropdown-ease),
    opacity var(--dropdown-close-dur) var(--dropdown-ease);
}

@media (prefers-reduced-motion: reduce) {
  .t-dropdown {
    transition: none !important;
  }
}

.message-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-left: 32px;
}
.message-content .message-text {
  flex: 1;
  min-width: 0;
  padding: 0;
  margin: 3px 0 0;
}
.message-reaction {
  position: relative;
  flex: none;
  width: 26px;
  height: 26px;
}
.message > .row > .comment-menu {
  margin-left: auto;
}
.message > .row > .comment-menu > summary {
  width: 24px;
  height: 24px;
}
.message .actions {
  margin-top: 8px;
}
.emoji-menu {
  position: fixed;
  z-index: 20;
  display: flex;
  gap: 2px;
  padding: 5px;
  background: #292929;
  border-radius: 12px;
  box-shadow:
    0 0 0 1px #ffffff12,
    0 8px 24px #0005;
}
.emoji-choice {
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 7px;
  opacity: 0;
  transform: translateX(-6px) scale(0.97);
  transition:
    transform var(--duration-fast) var(--ease-smooth-out),
    opacity var(--duration-fast) var(--ease-smooth-out);
}
.emoji-menu.is-open .emoji-choice {
  opacity: 1;
  transform: translateX(0) scale(1);
  transition-delay: calc(var(--emoji-index) * var(--duration-stagger));
}
.emoji-menu.is-closing .emoji-choice {
  opacity: 0;
  transform: scale(0.99);
  transition-duration: var(--duration-quick);
  transition-delay: 0ms;
}
.emoji-choice:hover {
  background: #ffffff12;
}
.reply-composer {
  position: relative;
  display: block;
}
.reply-composer textarea {
  width: 100%;
  padding-right: 44px;
}
.reply-composer > .send {
  position: absolute;
  right: 22px;
  top: 17px;
  width: 26px;
  height: 26px;
}
.new-comment-composer > .row > .send {
  margin-left: auto;
}
@media (prefers-reduced-motion: reduce) {
  .emoji-choice {
    transition: none !important;
  }
}

.comment-menu-items[popover] {
  position: fixed;
  inset: auto;
  margin: 0;
  border: 0;
}

.selection-menu > summary.selection-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 0;
  color: #eee;
  font-size: 15px;
  font-weight: 500;
  list-style: none;
  cursor: pointer;
}
.selection-trigger svg {
  width: 14px;
  height: 14px;
  flex: none;
  color: #888;
  transition: transform 150ms ease-out;
}
.selection-menu[open] > .selection-trigger svg {
  transform: rotate(180deg);
}
.selection-menu [aria-checked="false"] svg {
  opacity: 0;
}
.selection-menu [aria-checked="true"] {
  background: #ffffff0b;
}
.selection-menu .menu-action:last-child {
  margin-top: 0;
}
.selection-menu .menu-action:last-child::before {
  display: none;
}
.selection-menu .comment-menu-items:popover-open {
  animation: selection-enter 250ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: top right;
}
@keyframes selection-enter {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.panel-head {
  gap: 0;
}
.sidebar-search {
  display: grid;
  grid-template-rows: 0fr;
  transition:
    grid-template-rows 250ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 150ms ease-out;
}
.panel[data-search="true"] .sidebar-search {
  grid-template-rows: 1fr;
  opacity: 1;
}
.sidebar-search-inner {
  min-height: 0;
  overflow: hidden;
}
.sidebar-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
}
.sidebar-search-field {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  background: #ffffff0d;
  border-radius: 10px;
  padding: 0 10px;
}
.sidebar-search-field svg {
  flex: none;
  width: 16px;
  height: 16px;
  color: #888;
}
:host(.review-open) .panel .sidebar-search-field input {
  min-width: 0;
  width: 100%;
  padding: 9px 0;
  background: transparent;
  box-shadow: none;
  color: #eee;
  font-size: 14px;
}
.sidebar-search-field input::placeholder {
  color: #888;
}
.search-cancel {
  color: #ccc;
  font-size: 13px;
  padding: 8px 0;
  transform: translateX(8px);
  opacity: 0;
  transition:
    transform 250ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 150ms ease-out;
}
.panel[data-search="true"] .search-cancel {
  transform: none;
  opacity: 1;
}
.scope-slot .selection-trigger {
  font-size: 12px;
  color: #999;
  padding: 10px 12px 0 0;
}
@media (prefers-reduced-motion: reduce) {
  .sidebar-search,
  .search-cancel,
  .selection-trigger svg {
    transition: none;
  }
  .selection-menu .comment-menu-items:popover-open {
    animation: none;
  }
}

.dialog:has(.draft-close) .new-comment-composer {
  display: grid;
  gap: 8px;
  padding: 16px 16px 16px;
  box-shadow: none;
}
.new-comment-composer .draft-body {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 28px;
  grid-template-rows: minmax(28px, auto) 28px;
  align-items: start;
  column-gap: 12px;
  row-gap: 8px;
}
.new-comment-composer .draft-body:not(:has(.avatar)) { grid-template-columns: minmax(0, 1fr) 28px; }
.new-comment-composer .draft-body .avatar { grid-row: 1; grid-column: 1; }
.new-comment-composer .draft-body textarea { grid-row: 1; grid-column: 2; }
.new-comment-composer .draft-body:not(:has(.avatar)) textarea { grid-column: 1; }
.new-comment-composer .draft-body .send { grid-row: 2; grid-column: -2; }
.dialog .new-comment-composer .draft-body .avatar {
  position: relative;
  inset: auto;
  flex: none;
  width: 24px;
  height: 24px;
  margin: 0;
}
.dialog .new-comment-composer textarea,
.dialog .new-comment-composer textarea:focus {
  flex: 1;
  min-width: 0;
  min-height: 28px;
  padding: 3px 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  outline: none;
  line-height: 22px;
}
.dialog .new-comment-composer > .row {
  display: flex;
  justify-content: flex-end;
}
.dialog .new-comment-composer .send {
  position: static;
  width: 28px;
  height: 28px;
  margin-left: auto;
}

.pin-preview {
  width: 320px;
  border-radius: 18px;
}
.pin-preview-open {
  padding: 20px 16px 16px;
}
.pin-preview .row {
  gap: 8px;
  font-size: 12px;
}
.pin-preview .avatar {
  width: 24px;
  height: 24px;
  font-size: 9px;
}
.pin-preview .hover-message {
  margin: 3px 0 0;
  padding-left: 32px;
  line-height: 1.6;
}
.message-content {
  margin-right: -6px;
}
.message-reaction.has-reactions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: auto;
  min-width: 26px;
  max-width: 100px;
  padding: 3px;
  background: transparent;
}
.reaction-leaving {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  pointer-events: none;
}
.reaction-value {
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
}
.emoji-choice {
  width: 28px;
  height: 28px;
  font-size: 17px;
  color: #ccc;
}
.emoji-choice svg { width: 18px; height: 18px; stroke: currentColor; }
.emoji-choice:hover, .emoji-choice:focus-visible { color: #eee; }
.emoji-menu[data-placement="below"] .emoji-choice {
  transform: translateY(-4px) scale(0.97);
}
.emoji-menu[data-placement="below"].is-open .emoji-choice {
  transform: none;
  transition-delay: 0ms;
}
.emoji-menu[data-placement="below"].is-closing .emoji-choice {
  transform: scale(0.99);
  transition-delay: 0ms;
}

.dialog .new-comment-composer .draft-body .send {
  flex: none;
  margin: 0;
}

.comment-drag-handle { position: absolute; inset: 0 90px auto 0; height: 34px; z-index: 2; cursor: grab; touch-action: none; }
.toolbar { cursor: grab; touch-action: none; }
[data-dragging="true"], [data-dragging="true"] .comment-drag-handle { cursor: grabbing; user-select: none; }
[data-snap-x="left"]:not(.toolbar) { box-shadow: -3px 0 0 #ffffff70; }
[data-snap-x="right"]:not(.toolbar) { box-shadow: 3px 0 0 #ffffff70; }
[data-snap-y="top"]:not(.toolbar) { box-shadow: 0 -3px 0 #ffffff70; }
[data-snap-y="bottom"]:not(.toolbar) { box-shadow: 0 3px 0 #ffffff70; }
.toolbar::before, .toolbar::after { content: ""; position: absolute; pointer-events: none; background: #ffffff70; border-radius: 999px; opacity: 0; }
.toolbar::before { width: 2px; height: 28px; top: 50%; translate: 0 -50%; }
.toolbar::after { width: 28px; height: 2px; left: 50%; translate: -50% 0; }
.toolbar[data-snap-x="left"]::before { left: -10px; opacity: 1; }
.toolbar[data-snap-x="right"]::before { right: -10px; opacity: 1; }
.toolbar[data-snap-y="top"]::after { top: -10px; opacity: 1; }
.toolbar[data-snap-y="bottom"]::after { bottom: -10px; opacity: 1; }

.toolbar,
.panel,
.dialog-head,
.comment-drag-handle {
  -webkit-user-select: none;
  user-select: none;
}
.message-text,
.hover-message,
.thread-card p,
input,
textarea {
  -webkit-user-select: text;
  user-select: text;
}

.toolbar .morphing-menu [aria-current],
.toolbar .morphing-menu [aria-current]:hover {
  background: #ffffff0d;
  color: #cbb9ec;
  box-shadow: inset 0 0 0 1px #ffffff08;
}
:host(.review-open) .panel {
  height: calc(100% - 36px);
  padding-bottom: 0;
}
:host(.review-open) .panel .list {
  min-height: 0;
  /* Outdent by the card's 12px inset so comment text lines up with the header. */
  margin-inline: -12px;
  padding: 0 0 112px;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  scrollbar-gutter: stable;
  scroll-padding-bottom: 112px;
  -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 112px), transparent calc(100% - 24px));
  mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 112px), transparent calc(100% - 24px));
}
:host(.review-open) .panel .list[data-scrolling="true"] { scrollbar-color: #ffffff30 transparent; }
@supports selector(::-webkit-scrollbar) {
  :host(.review-open) .panel .list,
  :host(.review-open) .panel .list[data-scrolling="true"] { scrollbar-width: auto; scrollbar-color: auto; }
  :host(.review-open) .panel .list::-webkit-scrollbar { width: 4px; }
  :host(.review-open) .panel .list::-webkit-scrollbar-track { background: transparent; }
  :host(.review-open) .panel .list::-webkit-scrollbar-thumb { background: transparent; border-radius: 999px; }
  :host(.review-open) .panel .list[data-scrolling="true"]::-webkit-scrollbar-thumb { background: #ffffff30; }
  :host(.review-open) .panel .list[data-scrolling="true"]::-webkit-scrollbar-thumb:hover { background: #ffffff50; }
  :host(.review-open) .panel .list::-webkit-scrollbar-button { display: none; }
}
@media (max-width: 760px) {
  :host(.review-open) .panel { height: 100%; }
}

.toolbar > .morphing-menu {
  transition: translate 280ms cubic-bezier(.22,1,.36,1), scale 280ms cubic-bezier(.22,1,.36,1), opacity 200ms ease-in, filter 200ms ease-in;
}
.toolbar[data-away="true"] { pointer-events: none; }
.toolbar[data-away="true"] > .morphing-menu {
  translate: var(--drawer-away-x, 0px) var(--drawer-away-y, 24px);
  scale: .9;
  opacity: 0;
  filter: blur(4px);
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .toolbar > .morphing-menu { transition: none; }
  .toolbar[data-away="true"] > .morphing-menu { translate: none; scale: 1; filter: none; }
}

.morphing-menu[data-vertical="true"] {
  width: var(--mm-bar-height);
  height: var(--mm-bar-width);
}
.morphing-menu[data-vertical="true"] .morphing-menu__bar {
  flex-direction: column;
  width: var(--mm-bar-height);
  height: var(--mm-bar-width);
  left: 0;
  top: 0;
  bottom: auto;
  translate: none;
}
.morphing-menu[data-vertical="true"] .morphing-menu__shortcut {
  width: var(--mm-button);
  height: 0;
}
.morphing-menu[data-edge="top"] .morphing-menu__shell {
  top: 0;
  bottom: auto;
}
.morphing-menu[data-vertical="true"] .morphing-menu__shell {
  left: 0;
  top: 0;
  bottom: auto;
  translate: none;
}
.morphing-menu[data-edge="right"] .morphing-menu__shell {
  left: auto;
  right: 0;
}
.morphing-menu[data-vertical="true"][data-align-end="true"] .morphing-menu__shell {
  top: auto;
  bottom: 0;
}
.morphing-menu[data-vertical="true"][data-align-end="true"] .morphing-menu__bar {
  top: auto;
  bottom: 0;
}
.morphing-menu[data-edge="right"] .morphing-menu__bar {
  left: auto;
  right: 0;
}
.morphing-menu__tooltip { bottom: auto; translate: -50% -100%; max-width: calc(100vw - 16px); overflow: hidden; text-overflow: ellipsis; }
.morphing-menu[data-edge="top"] .morphing-menu__tooltip { translate: -50% 0; }
.morphing-menu[data-edge="left"] .morphing-menu__tooltip { translate: 0 -50%; }
.morphing-menu[data-edge="right"] .morphing-menu__tooltip { translate: -100% -50%; }

.emoji-choice[aria-checked="true"],
.emoji-choice[aria-checked="true"]:hover {
  background: #ffffff12;
  box-shadow: inset 0 0 0 1px #ffffff0a;
}

:host(.review-open) .toolbar { cursor: default; touch-action: auto; }

/* Keep the custom close-search control; hide WebKit's native clear button. */
.sidebar-search-field input::-webkit-search-cancel-button,
.sidebar-search-field input::-webkit-search-decoration {
  -webkit-appearance: none;
  display: none;
}
:host(.review-open) .toolbar .morphing-menu [data-menu-item="comments"],
:host(.review-open) .toolbar .morphing-menu [data-menu-item="comments"]:hover {
  background: #ffffff0d;
  color: #cbb9ec;
  box-shadow: inset 0 0 0 1px #ffffff08;
}

.toolbar[data-intro-wait="true"] > .morphing-menu { transition: none; }
.toolbar[data-intro="true"][data-away="true"] > .morphing-menu {
  translate: 0 var(--drawer-intro-y, 100vh);
  scale: 1;
  filter: none;
}
.toolbar[data-away="true"][data-peek="true"] > .morphing-menu {
  translate: 0 var(--drawer-peek-y, 100vh);
  scale: 1;
  opacity: 1;
  filter: none;
}

.toolbar .morphing-menu__row[aria-current] svg { color: inherit; }
.sidebar-selector { display: grid; min-width: 0; }
.sidebar-selector > * { grid-area: 1 / 1; transition: opacity 200ms ease, transform 250ms cubic-bezier(.22,1,.36,1); }
.sidebar-selector .scope-slot { opacity: 0; transform: translateY(6px); pointer-events: none; }
.panel[data-search="true"] .sidebar-selector .filter-slot { opacity: 0; transform: translateY(-6px); pointer-events: none; }
.panel[data-search="true"] .sidebar-selector .scope-slot { opacity: 1; transform: none; pointer-events: auto; }
.sidebar-selector .scope-slot .selection-trigger { font-size: 15px; color: #f4f4f4; padding: 8px 12px 8px 0; font-weight: 600; }
.copy-page-prompt { display: grid; place-items: center; translate: 0 0; transition: translate 280ms cubic-bezier(.22,1,.36,1); }
.copy-page-prompt > svg { grid-area: 1 / 1; transform-origin: center; }
.panel[data-search="true"] .copy-page-prompt { display: grid; place-items: center; translate: calc(100% + 4px) 0; }
.sidebar-search-trigger { transition: opacity 150ms ease; }
.panel[data-search="true"] .sidebar-search-trigger { opacity: 0; pointer-events: none; }
.sidebar-search { opacity: 1; }
.panel[data-search="true"] .sidebar-search-inner { overflow: visible; }
.sidebar-search-field { flex: none; transform-origin: top left; box-sizing: border-box; overflow: hidden; width: 100%; }
.sidebar-search-field .search-cancel { flex: none; padding: 0; width: 24px; height: 24px; }
.sidebar-search-field input { transition: opacity 150ms ease; }
.panel[data-search="false"] .sidebar-search-field input { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .sidebar-selector > *, .copy-page-prompt, .sidebar-search-trigger, .sidebar-search-field input { transition: none; }
}

.toolbar .morphing-menu__panel > .morphing-menu__row:first-child,
.toolbar .morphing-menu__panel > .morphing-menu__row:last-child {
  transition: background 150ms ease, scale 180ms var(--ease-smooth-out), border-radius 150ms var(--ease-smooth-out);
}
.toolbar .morphing-menu__panel > .morphing-menu__row:first-child {
  border-top-left-radius: calc(var(--mm-radius) - var(--mm-panel-padding));
  border-top-right-radius: calc(var(--mm-radius) - var(--mm-panel-padding));
}
.toolbar .morphing-menu__panel > .morphing-menu__row:last-child {
  border-bottom-left-radius: calc(var(--mm-radius) - var(--mm-panel-padding));
  border-bottom-right-radius: calc(var(--mm-radius) - var(--mm-panel-padding));
}
.toolbar .morphing-menu__panel > .morphing-menu__row:first-child:active {
  border-top-left-radius: 9px;
  border-top-right-radius: 9px;
}
.toolbar .morphing-menu__panel > .morphing-menu__row:last-child:active {
  border-bottom-left-radius: 9px;
  border-bottom-right-radius: 9px;
}
@media (prefers-reduced-motion: reduce) {
  .toolbar .morphing-menu__panel > .morphing-menu__row:first-child,
  .toolbar .morphing-menu__panel > .morphing-menu__row:last-child { transition: none; }
}

.avatar, .pin { background: var(--reviewer-accent, #c8b5f4); color: var(--reviewer-ink, #352a50); }
.avatar:has(img) { outline: 2px solid var(--reviewer-accent, #c8b5f4); outline-offset: 1px; }
.account-accent { display: grid; gap: 12px; }
.account-accent-label { color: #aaa; font-size: 12px; }
.accent-swatches { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.account-layer .account .accent-swatch { position: relative; flex: none; width: 32px; height: 32px; padding: 4px; border-radius: 50%; background: transparent; box-shadow: none; }
.accent-swatch::before { content: ""; position: absolute; inset: 4px; border-radius: inherit; background: var(--swatch); }
.account .accent-swatch[aria-pressed="true"] { box-shadow: inset 0 0 0 1.5px #eee; }
.account .accent-swatch:hover { background: #ffffff0d; }
.account .accent-swatch:focus-visible { outline: 2px solid #eee; outline-offset: 2px; }
.accent-custom::before { background: conic-gradient(#f46021, #f9b73b, #2e9d51, #38c5f6, #1f72ff, #9038fc, #f46021); }
.accent-custom svg { position: relative; width: 16px; height: 16px; padding: 2px; border-radius: 50%; background: #252525; color: #eee; }

.emoji-keyboard { position: fixed; z-index: 21; width: min(300px, calc(100vw - 16px)); max-height: calc(100dvh - 16px); overflow: auto; border-radius: 16px; background: #252525; box-shadow: 0 0 0 1px #ffffff12, 0 12px 32px #0006; }
.emoji-keyboard-close { position: absolute; top: 12px; right: 10px; z-index: 2; width: 26px; height: 26px; color: #999; }
.emoji-keyboard-status { display: block; padding: 20px; color: #aaa; font-size: 12px; }
.emoji-keyboard emoji-picker { width: 100%; height: min(300px, calc(100dvh - 32px)); --background: #252525; --border-color: transparent; --button-hover-background: #ffffff10; --button-active-background: #ffffff18; --input-border-color: #ffffff12; --input-border-radius: 8px; --input-font-color: #eee; --indicator-color: #c8b5f4; --outline-color: #c8b5f4; --num-columns: 8; --emoji-size: 20px; --emoji-padding: 6px; --category-emoji-size: 16px; --category-emoji-padding: 6px; }

.pin .avatar:has(img) { outline: none; }
.pin .avatar img { object-fit: cover; object-position: center; pointer-events: none; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-user-drag: none; -webkit-touch-callout: none; }
.menu-action.destructive { color: #ff9696; }
.menu-action.destructive svg { color: inherit; }
.menu-action.destructive:hover, .menu-action.destructive:focus-visible { background: #ff6b6b14; color: #ffb0b0; }
.accent-popover { position: fixed; inset: auto; margin: 0; width: min(240px, calc(100vw - 16px)); padding: 0; border: 0; border-radius: 12px; background: #292929; color: #ddd; box-shadow: 0 0 0 1px #ffffff12, 0 8px 24px #0005; transform-origin: bottom right; }
.accent-popover-head { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; font-size: 11px; box-shadow: 0 1px #ffffff0d; }
.accent-popover-head span:last-child { color: #999; font-variant-numeric: tabular-nums; }
.accent-picker-body { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
.accent-picker-body .react-colorful { width: 100%; height: 148px; }
.accent-picker-body .react-colorful__saturation { border-radius: 8px; border-bottom: none; }
.accent-picker-body .react-colorful__hue { height: 14px; margin-top: 10px; border-radius: 8px; }
.accent-picker-body .react-colorful__pointer { width: 14px; height: 14px; }
.accent-picker-body .react-colorful__hue-pointer { width: 10px; height: 18px; border-radius: 6px; }
.accent-picker-body input.accent-hex { width: 100%; height: 28px; min-height: 28px; padding: 5px 8px; border-radius: 6px; background: #ffffff08; color: #eee; font-size: 12px; box-shadow: inset 0 0 0 1px #ffffff0c; }

.pin {
  --pin-x: -9px;
  transform: translate(var(--pin-x), -28px) scale(1);
  transform-origin: bottom left;
  transition: transform 120ms cubic-bezier(.22,1,.36,1);
}
.pin[data-pointer="right"] {
  --pin-x: -25px;
  border-radius: 50% 50% 5px 50%;
  transform-origin: bottom right;
}
.pins { transition:opacity 120ms ease; }
.pins[data-scrolling="true"] { opacity:0; }
.pins[data-scrolling="true"] .pin { pointer-events:none; }
@media (prefers-reduced-motion: reduce) {
  .pin, .pins { transition: none; }
}

.pin-stack {
  position: fixed; display: flex; align-items: center; padding: 3px;
  overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
  pointer-events: auto; z-index: 2; isolation: isolate;
}
.pin-stack::-webkit-scrollbar { display: none; }
.pin-stack .pin:not([data-dragging]) {
  position: relative; flex: 0 0 34px; transform: scale(1);
  margin-left: -12px;
}
.pin-stack .pin:not([data-dragging]):first-child { margin-left: 0; }
.pin-stack .pin:hover, .pin-stack .pin:focus-visible, .pin-stack .pin.active { z-index: 4; }
.pins[data-scrolling="true"] .pin-stack { pointer-events: none; }


.onboarding-panel { display: grid; gap: 16px; }
.onboarding-panel > p:empty { display: none; }
.approved-sites { display: grid; gap: 8px; font-size: 12px; overflow-wrap: anywhere; color: #ddd; }
.approved-sites:empty { display: none; }
/* Grid tracks default to min-content, so long hosts would widen the dialog. */
.account-usage, .approved-sites-editor, .approved-site-list { min-width: 0; grid-template-columns: minmax(0, 1fr); }
.approved-sites-editor { display: grid; padding-top: 4px; border-top: 1px solid #ffffff0d; }
.approved-sites-toggle { min-width: 0; min-height: 36px; margin: 0 -8px; padding: 0 8px; display: flex; align-items: center; gap: 8px; border-radius: 8px; background: transparent; font-size: 12px; color: #ddd; text-align: left; cursor: pointer; }
.approved-sites-toggle:hover { background: #ffffff08; }
.approved-sites-toggle:focus-visible { outline: 2px solid #bda6ef; outline-offset: -2px; }
.approved-sites-toggle > span:first-child { flex: 1; }
.approved-sites-count { color: #aaa; font-variant-numeric: tabular-nums; }
.approved-sites-toggle svg { width: 14px; height: 14px; color: #888; transition: transform 250ms cubic-bezier(.22,1,.36,1); }
.approved-sites-editor[data-open="true"] .approved-sites-toggle svg { transform: rotate(180deg); }
.approved-sites-reveal { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 250ms cubic-bezier(.22,1,.36,1); }
.approved-sites-editor[data-open="true"] .approved-sites-reveal { grid-template-rows: 1fr; }
.approved-sites-body { min-height: 0; min-width: 0; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.approved-sites-editor[data-open="true"] .approved-sites-body { padding-top: 4px; }
.approved-site-list { display: grid; margin: 0; padding: 0; list-style: none; }
.approved-site { min-width: 0; min-height: 32px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: #ddd; }
.approved-site > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Same close button as the dialog head; undo the account form's 12px radius. */
.approved-site > button { flex-shrink: 0; opacity: 0; transition: opacity 120ms; }
.account-layer .account .approved-site > .icon { border-radius: 7px; }
.approved-site:hover > button, .approved-site > button:focus-visible { opacity: 1; }
@media (hover: none) { .approved-site > button { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .approved-sites-reveal, .approved-sites-toggle svg { transition: none; } }
.approved-site-add { min-width: 0; display: flex; gap: 8px; }
.account .approved-site-add input { width: 0; min-width: 0; flex: 1; font-size: 13px; padding: 8px 10px; }
.approved-site-add > button { flex-shrink: 0; padding: 0 12px; }
.approved-sites-body > .account-usage-status:empty { display: none; }
.account-usage { min-height: 144px; box-sizing: border-box; align-content: start; display: grid; gap: 14px; padding: 16px; border-radius: 14px; background: #ffffff05; box-shadow: inset 0 0 0 1px #ffffff09; }
.account-usage h3 { line-height: 18px; margin: 0; font-size: 12px; font-weight: 500; color: #aaa; }
.usage-skeleton { display: block; height: 10px; border-radius: 4px; background: #ffffff0b; }
.usage-skeleton-heading { height: 18px; display: flex; align-items: center; }
.usage-skeleton-title { width: 70px; }
.usage-skeleton-label { width: 88px; align-self: center; }
.usage-skeleton-count { width: 56px; align-self: center; }
.usage-skeleton-ring { width: 22px; height: 22px; border-radius: 50%; mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px)); }
.account-sites[aria-busy="true"] .account-sites-summary { justify-content: space-between; color: #888; }
.account-projects { display: grid; gap: 12px; padding-bottom: 4px; }
.account-projects .account-usage-label { height: 20px; align-items: center; }
.account-project-count { display: flex; align-items: baseline; gap: 6px; }
.account-project-count strong { font-size: 16px; line-height: 1; font-weight: 500; color: #eee; }
.account-project-count > span { font-size: 12px; color: #909090; }
.account-project-slots { display: flex; gap: 6px; }
.account-project-slots > span { flex: 1; height: 4px; border-radius: 2px; background: #ffffff0b; box-shadow: inset 0 0 0 1px #ffffff07; }
.account-project-slots > span[data-used="true"] { background: #bda6ef; box-shadow: inset 0 1px 0 #ffffff26; }
.account-usage-label { line-height: 18px; display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: #ddd; font-variant-numeric: tabular-nums; }
.account-usage-label > :last-child { color: #aaa; }
.account-comments { align-items: center; min-height: 24px; }
.account-comment-count { display: flex; align-items: center; gap: 10px; }
.account-usage-ring { display: block; width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%; background: conic-gradient(#bda6ef var(--usage), #ffffff12 0); mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px)); }
.account-usage-ring[data-full="true"] { background: conic-gradient(#f1b77d var(--usage), #ffffff12 0); }
.account-sites { border-radius: 14px; background: #ffffff05; box-shadow: inset 0 0 0 1px #ffffff09; }
.account-sites-summary { line-height: 18px; width: 100%; background: transparent; border-radius: inherit; text-align: left; display: flex; align-items: center; gap: 10px; padding: 16px; font-size: 12px; color: #bbb; cursor: pointer; list-style: none; }
.account-sites-summary:hover { color: #eee; }
.account-sites-summary:focus-visible { outline: 2px solid #bda6ef; outline-offset: -2px; border-radius: inherit; }
.account-sites-count { margin-left: auto; color: #888; font-variant-numeric: tabular-nums; }
.account-sites-summary svg { width: 14px; height: 14px; color: #888; transform: scaleY(1); transition: transform 250ms cubic-bezier(.22,1,.36,1); }
.account-sites-summary svg path { vector-effect: non-scaling-stroke; }
.account-sites[data-open="true"] .account-sites-summary svg { transform: scaleY(-1); }
.account-sites-reveal { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 250ms cubic-bezier(.22,1,.36,1); }
.account-sites[data-open="true"] .account-sites-reveal { grid-template-rows: 1fr; }
.account-sites-clip { min-height: 0; overflow: hidden; opacity: 0; transition: opacity 250ms cubic-bezier(.22,1,.36,1); }
.account-sites[data-open="true"] .account-sites-clip { opacity: 1; }
.account-sites-note { display: flex; align-items: flex-start; gap: 7px; }
.account-sites-note > svg { flex-shrink: 0; width: 13px; height: 13px; margin-top: 2px; color: #777; }
.account-sites-note > span { text-wrap: balance; }
@media (prefers-reduced-motion: reduce) {
  .account-sites-reveal, .account-sites-clip, .account-sites-summary svg { transition: none; }
}
.account-sites-content { display: grid; gap: 14px; padding: 0 16px 16px; }
.account-usage-status, .account-usage-note { font-size: 11px; line-height: 1.5; color: #909090; }

@media (max-width: 760px), (max-width: 1000px) and (max-height: 500px) {

 :host(.review-open) .toolbar { bottom:calc(16px + env(safe-area-inset-bottom,0px)); }
 :host(.review-open) .account-layer { position:absolute; top:var(--review-sheet-top,42%); bottom:0; width:100%; padding:calc(24px + env(safe-area-inset-top,0px)) 12px calc(24px + env(safe-area-inset-bottom,0px)); border-radius:24px 24px 0 0; overflow:hidden; }
 .account-layer .account-dialog { max-height:100%; min-height:0; overscroll-behavior:contain; }
 .account-layer .account { padding:28px 20px 20px; }
 .panel-head .icon { min-width:40px; min-height:40px; }
 .dialog:not(.account-dialog) { width:calc(100vw - 32px); max-height:calc(var(--review-viewport-height,100dvh) - 100px); }
 :host :is(input, textarea, select) { font-size:16px !important; }
 :host(.review-open) .panel .sidebar-search-field input { font-size:16px; }
}
@media(prefers-reduced-motion:reduce) { :host(.review-open) .panel { animation:none; transition:none; } }

/* Edge sidebar: a floating, draggable sidebar that parks off and peeks from a
   viewport edge while collapsed (panels-inspired; see NOTICE.md). */
:host([data-sidebar="edge"]) .edge-sidebar {
  position: fixed;
  display: flex;
  flex-direction: column;
  width: var(--edge-sidebar-width, 380px);
  max-width: calc(100dvw - 32px);
  height: min(calc(100dvh - 32px), 600px);
  max-height: min(calc(100dvh - 32px), 680px);
  background: #0d0d0d;
  color: #e9e6e1;
  border-radius: 16px;
  box-shadow: inset 0 0 0 1px #ffffff12, 0 24px 70px #00000066;
  overflow: hidden;
  pointer-events: auto;
  z-index: 4;
  transition: transform 320ms cubic-bezier(.22,1,.36,1), opacity 200ms ease;
  transform-origin: right center;
}
:host([data-sidebar="edge"]) .edge-sidebar[data-collapsed="true"] {
  transform: translateX(var(--edge-park-x, 404px));
  opacity: 0;
  pointer-events: none;
}
:host([data-sidebar="edge"]) .edge-sidebar[data-collapsed="true"][data-peek="true"] {
  transform: translateX(var(--edge-peek-x, -304px)) scale(.96);
  opacity: 1;
  pointer-events: auto;
}
:host([data-sidebar="edge"]) .edge-sidebar[data-dragging="true"] {
  overflow: visible;
}
:host([data-sidebar="edge"]) .edge-sidebar .edge-sidebar-grip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 7;
  flex: none;
  height: 30px;
  display: grid;
  place-items: center;
  cursor: grab;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
:host([data-sidebar="edge"]) .edge-sidebar .edge-sidebar-grip::before {
  content: "";
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: #ffffff22;
}
:host([data-sidebar="edge"]) .edge-sidebar .edge-sidebar-grip:hover::before,
:host([data-sidebar="edge"]) .edge-sidebar[data-dragging="true"] .edge-sidebar-grip::before {
  background: #ffffff3a;
}
:host([data-sidebar="edge"]) .edge-sidebar[data-dragging="true"] .edge-sidebar-grip {
  cursor: grabbing;
}
.edge-sidebar-resize {
  position: absolute;
  z-index: 8;
  touch-action: none;
}
.edge-sidebar-resize-n, .edge-sidebar-resize-s {
  right: 12px;
  left: 12px;
  height: 5px;
  cursor: ns-resize;
}
.edge-sidebar-resize-e, .edge-sidebar-resize-w {
  top: 12px;
  bottom: 12px;
  width: 5px;
  cursor: ew-resize;
}
.edge-sidebar-resize-n { top: 0; }
.edge-sidebar-resize-s { bottom: 0; }
.edge-sidebar-resize-e { right: 0; }
.edge-sidebar-resize-w { left: 0; }
.edge-sidebar-resize-ne, .edge-sidebar-resize-nw,
.edge-sidebar-resize-se, .edge-sidebar-resize-sw {
  width: 12px;
  height: 12px;
}
.edge-sidebar-resize-ne { top: 0; right: 0; cursor: nesw-resize; }
.edge-sidebar-resize-nw { top: 0; left: 0; cursor: nwse-resize; }
.edge-sidebar-resize-se { right: 0; bottom: 0; cursor: nwse-resize; }
.edge-sidebar-resize-sw { bottom: 0; left: 0; cursor: nesw-resize; }
.edge-sidebar-resize-n::after, .edge-sidebar-resize-s::after,
.edge-sidebar-resize-e::after, .edge-sidebar-resize-w::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  background: #ffffff99;
  opacity: 0;
  transform: scale(0.4);
  transition: opacity 140ms cubic-bezier(.22,1,.36,1), transform 220ms cubic-bezier(.35,1.55,.65,1);
}
.edge-sidebar-resize-e::after, .edge-sidebar-resize-w::after {
  top: 50%;
  width: 3px;
  height: 28px;
  margin-top: -14px;
}
.edge-sidebar-resize-n::after, .edge-sidebar-resize-s::after {
  left: 50%;
  width: 28px;
  height: 3px;
  margin-left: -14px;
}
.edge-sidebar-resize-w::after { left: 7px; }
.edge-sidebar-resize-e::after { right: 7px; }
.edge-sidebar-resize-n::after { top: 7px; }
.edge-sidebar-resize-s::after { bottom: 7px; }
.edge-sidebar-resize-n:hover::after, .edge-sidebar-resize-s:hover::after,
.edge-sidebar-resize-e:hover::after, .edge-sidebar-resize-w:hover::after {
  opacity: 1;
  transform: scale(1);
}
.edge-sidebar-snap {
  pointer-events: none;
  position: absolute;
  z-index: 9;
  border-radius: 999px;
  background: #0d0d0d;
  box-shadow: inset 0 0 0 1px #ffffff12;
  opacity: 0;
  transition: opacity 140ms cubic-bezier(.22,1,.36,1), transform 220ms cubic-bezier(.35,1.55,.65,1);
}
.edge-sidebar-snap-left, .edge-sidebar-snap-right {
  top: 50%;
  width: 4px;
  height: 28px;
  transform: translateY(-50%) scale(0.4);
}
.edge-sidebar-snap-top, .edge-sidebar-snap-bottom {
  left: 50%;
  width: 28px;
  height: 4px;
  transform: translateX(-50%) scale(0.4);
}
.edge-sidebar-snap-left { left: -8px; }
.edge-sidebar-snap-right { right: -8px; }
.edge-sidebar-snap-top { top: -8px; }
.edge-sidebar-snap-bottom { bottom: -8px; }
:host([data-sidebar="edge"]) .edge-sidebar[data-snap-x="left"] .edge-sidebar-snap-left,
:host([data-sidebar="edge"]) .edge-sidebar[data-snap-x="right"] .edge-sidebar-snap-right {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}
:host([data-sidebar="edge"]) .edge-sidebar[data-snap-y="top"] .edge-sidebar-snap-top,
:host([data-sidebar="edge"]) .edge-sidebar[data-snap-y="bottom"] .edge-sidebar-snap-bottom {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}
:host([data-sidebar="edge"]) .edge-sidebar .panel {
  position: static;
  z-index: auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 30px;
  background: transparent;
  color: inherit;
  box-shadow: none;
  border-radius: 0;
}
:host([data-sidebar="edge"]) .edge-sidebar .panel .list {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  scrollbar-gutter: stable;
  box-sizing: border-box;
  /* Outdent by the card's 12px inset so comment text lines up with the header. */
  margin-inline: -12px;
  padding: 0 0 24px;
  -webkit-mask-image: none;
  mask-image: none;
}
:host([data-sidebar="edge"]) .edge-sidebar .panel .list[data-scrolling="true"],
:host([data-sidebar="edge"]) .edge-sidebar .panel .list:hover {
  scrollbar-color: #ffffff30 transparent;
}
:host([data-sidebar="edge"]) .edge-sidebar-sensor {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 24px;
  z-index: 3;
  cursor: pointer;
  pointer-events: auto;
}
:host([data-sidebar="edge"]) .edge-sidebar-sensor[hidden] { display: none; }
:host([data-sidebar="edge"]) .toolbar:not([data-edge-tabs="true"]) {
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}
/* Expanded edge sidebar keeps the drawer as a tab bar along the bottom. */
:host([data-sidebar="edge"]) .toolbar[data-edge-tabs="true"] {
  position: relative;
  left: auto;
  right: auto;
  top: auto;
  bottom: auto;
  transform: none;
  flex: none;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 0 12px 12px;
  z-index: 6;
  pointer-events: none;
  background: transparent;
}
:host([data-sidebar="edge"]) .toolbar[data-edge-tabs="true"] .morphing-menu {
  pointer-events: auto;
}
:host([data-sidebar="edge"]) .toolbar[data-edge-orient="horizontal"] .morphing-menu,
:host([data-sidebar="edge"]) .toolbar[data-edge-orient="horizontal"] .morphing-menu[data-vertical="true"] {
  width: var(--mm-bar-width);
  height: var(--mm-bar-height);
}
:host([data-sidebar="edge"]) .toolbar[data-edge-orient="horizontal"] .morphing-menu__bar,
:host([data-sidebar="edge"]) .toolbar[data-edge-orient="horizontal"] .morphing-menu__shell {
  flex-direction: row;
  left: 50%;
  right: auto;
  top: auto;
  bottom: 0;
  translate: -50% 0;
  width: var(--mm-bar-width);
  height: var(--mm-bar-height);
}
:host([data-sidebar="edge"]) .toolbar[data-edge-orient="horizontal"] .morphing-menu__shortcut {
  width: 0;
  height: var(--mm-button);
  flex: 1;
}
:host([data-sidebar="edge"]) .edge-sidebar[data-morphing="true"] .panel {
  padding-top: 0;
  flex-basis: 0;
  overflow: hidden;
}
:host([data-sidebar="edge"]) .edge-sidebar[data-morphing="true"] .toolbar[data-edge-tabs="true"] {
  padding-bottom: 0;
}
/* Account sits over the edge sidebar, inset from the sides and top, with no scrim.
   Its height is the dialog's own height, so it can extend past the sidebar.
   Background mode keeps the viewport column and overlay. */
:host([data-sidebar="edge"]) .edge-sidebar:has(> .account-layer) {
  overflow: visible;
}
:host([data-sidebar="edge"]) .edge-sidebar > .account-layer {
  position: absolute;
  top: 12px;
  right: 10px;
  left: 10px;
  bottom: auto;
  width: auto;
  height: auto;
  padding: 0;
  background: none;
  place-items: start stretch;
  pointer-events: none;
  z-index: 10;
}
:host([data-sidebar="edge"]) .edge-sidebar > .account-layer .account-dialog {
  max-height: min(calc(100dvh - 32px), var(--edge-account-max-height, calc(100dvh - 120px)));
  width: 100%;
  pointer-events: auto;
}
:host([data-sidebar="edge"]) .toolbar[data-hidden="true"] > .morphing-menu {
  transition: none;
}
.toolbar[data-hidden="true"] { pointer-events: none; }
.toolbar[data-hidden="true"] > .morphing-menu {
  translate: 0 8px;
  scale: .92;
  opacity: 0;
  filter: blur(6px);
}
@media (prefers-reduced-motion: reduce) {
  :host([data-sidebar="edge"]) .edge-sidebar { transition: none; }
  .toolbar[data-hidden="true"] > .morphing-menu { translate: none; scale: 1; filter: none; }
}
.sidebar-tooltip {
  position: fixed;
  z-index: 30;
  translate: -50% 0;
}
.sidebar-tip {
  position: absolute;
  z-index: 5;
  translate: none;
  display: flex;
  align-items: center;
  gap: 2px;
  width: max-content;
  max-width: 236px;
  padding: 8px 4px 8px 12px;
  white-space: normal;
  overflow: visible;
  pointer-events: auto;
}
.sidebar-tip[hidden] { display: none; }
.sidebar-tip p { margin: 0; font-size: 13px; line-height: 18px; }
.sidebar-tip .icon { flex: none; width: 24px; height: 24px; border-radius: 8px; color: inherit; opacity: .45; }
.sidebar-tip .icon:hover { opacity: 1; background: light-dark(#0000000d, #ffffff14); }
.sidebar-tip .icon svg { width: 14px; height: 14px; }
.sidebar-tip::before {
  content: "";
  position: absolute;
  left: var(--caret-x);
  bottom: 100%;
  width: 10px;
  height: 10px;
  margin: 0 0 -5px -5px;
  background: inherit;
  border-radius: 2px 0;
  rotate: 45deg;
}
.sidebar-tip[data-tip="shortcut"]::before { bottom: auto; top: 100%; margin: -5px 0 0 -5px; }
.list[data-empty] { display: flex; flex-direction: column; }
.list[data-empty] .empty { flex: 1; align-content: center; }
.sidebar-tooltip, .sidebar-tip { transition: var(--duration-quick) var(--ease-smooth-out); transition-property: opacity, transform, filter; }
.sidebar-tooltip:not([data-open]), .sidebar-tip[data-leaving] { opacity: 0; transform: translateY(-4px); filter: blur(2px); }
.sidebar-tip { transform-origin: var(--caret-x) top; animation: tip-in var(--duration-fast) var(--ease-smooth-out) backwards; }
.sidebar-tip[data-tip="shortcut"] { transform-origin: var(--caret-x) bottom; }
@keyframes tip-in { from { opacity: 0; transform: scale(.98); } }
.edge-sidebar:not([data-tips-ready]) .sidebar-tip { opacity: 0; animation: none; pointer-events: none; }
[data-tips-restored] .sidebar-tip { animation: none; transition: none; }
@media (hover: none) { .sidebar-tip[data-tip="shortcut"] { display: none; } }
@media (prefers-reduced-motion: reduce) { .sidebar-tooltip, .sidebar-tip { transition: none; animation: none; } }

/* On mobile the comments sidebar grows from the toolbar, anchored to the
   visible viewport. Only the panel moves; the page keeps its own colors. */
:host([data-sidebar="mobile"]) .sidebar-tip { display:none !important; }
:host([data-sidebar="mobile"]) .panel {
  position:fixed; inset:auto 12px calc(var(--mobile-panel-bottom,0px) + 6px);
  width:auto; height:var(--mobile-panel-height,90vh); min-height:0;
  padding:20px 20px 10px; display:flex; flex-direction:column;
  background:#0d0d0d; color:#e9e6e1; border-radius:24px;
  box-shadow:0 -1px 0 #ffffff24; overflow:hidden;
  pointer-events:none; visibility:hidden; opacity:0;
  transform-origin:bottom center;
  translate:var(--mobile-pill-x,0px) var(--mobile-pill-y,-24px);
  scale:var(--mobile-pill-scale-x,.6) var(--mobile-pill-scale-y,.08);
  will-change:translate,scale,opacity;
  transition:translate 320ms cubic-bezier(.22,1,.36,1),
    scale 320ms cubic-bezier(.22,1,.36,1), opacity 150ms ease,
    visibility 0s linear 320ms;
  z-index:8;
}
:host([data-sidebar="mobile"].review-open:not([data-mobile-entering])) .panel {
  pointer-events:auto; visibility:visible; opacity:1; translate:0 0; scale:1;
  transition:translate 320ms cubic-bezier(.22,1,.36,1),
    scale 320ms cubic-bezier(.22,1,.36,1), opacity 150ms ease,
    visibility 0s;
}
:host([data-sidebar="mobile"]) .panel::before { display:none; }
:host([data-sidebar="mobile"]) .panel .list {
  flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain;
  touch-action:pan-y; margin-inline:0; padding-bottom:calc(88px + env(safe-area-inset-bottom,0px));
  -webkit-mask-image:none; mask-image:none; scrollbar-gutter:auto;
}
:host([data-sidebar="mobile"]) .toolbar { position:absolute; z-index:10; }
:host([data-sidebar="mobile"].review-open) .toolbar .morphing-menu { --mm-surface:#282828; }
:host([data-sidebar="mobile"].review-open) .toolbar .morphing-menu__shell { backdrop-filter:none; }
:host([data-sidebar="mobile"]) .account-layer {
  position:fixed;
  inset:auto 20px calc(var(--mobile-panel-bottom,0px) + 14px);
  width:auto;
  height:calc(var(--mobile-panel-height,90vh) - 16px);
  padding:0;
  background:none;
  border-radius:0;
  overflow:visible;
  pointer-events:none;
  z-index:11;
}
:host([data-sidebar="mobile"]) .account-layer .account-dialog {
  max-width:100%;
  max-height:100%;
  pointer-events:auto;
}
@media (prefers-reduced-motion:reduce) {
  :host([data-sidebar="mobile"]) .panel { transition:none; }
}
`;
