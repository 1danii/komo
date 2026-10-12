# komo

- Product and brand name: **komo**, always lowercase. Preserve public API names such as `initKomo`.
- Package, CLI, API and tests: `packages/komo/`. Marketing website: `packages/komo-site/`.
- Use pnpm with Node 22.12 or later. Run `pnpm build`, `pnpm typecheck`, `pnpm test`, and `pnpm size` before delivery.
- Keep browser bundle costs within the existing measured budgets. CLI-only code must not enter browser bundles.
- Never commit credentials, local databases, generated bundles, or npm tarballs.
- Preserve API authentication, project boundaries, quotas, and data compatibility.
- Deliver changes on a feature branch with a verified deployed preview. Use preview versions of the existing `komo-site` Worker; do not use Cloudflare Pages. Never merge without approval. Validate locally; hosted CI is not a delivery gate.
- Create pull requests only when the user explicitly asks. Target `1danii/komo` and pass `--repo 1danii/komo` explicitly to GitHub CLI PR commands. Never create a pull request against `tjcages/komo`; it is reference-only upstream.
- Keep user-facing copy concise and use the existing components and motion conventions.

## Linear tracking

- Linear is the source of truth for project work. Follow `linear-discipline` and `linear-setup`; authenticate with official Linear MCP before reads or writes.
- Search for `komo`, `Komo`, and `https://github.com/tjcages/komo` before creating a project or issue. Preserve existing work and obtain the skill's required approvals before extending an existing project.
- Official MCP authentication and search completed on 2026-09-17 after restart. Team: **Off-brand** (`OFF`), ID `7c1223a3-ebb1-42a3-9ba7-5f0a4a776933`.
- Project: [komo](https://linear.app/off-brand-studio/project/komo-9f81aa4f25a3), ID `c75f51ee-3d39-43ad-b561-0034122e8d09`.
- Milestones: Release readiness (`e4bb27cb-3cc8-4d77-aae3-b07e22e0e7f6`), Launch assets (`8966e200-be31-4a49-9f02-63984259aebc`), Beta rollout (`f4765f25-5c00-4b5b-b901-522f404ffd29`).
- Active creative review: [OFF-672](https://linear.app/off-brand-studio/issue/OFF-672). Release evidence OFF-673/674; branding OFF-675; CLI cleanup OFF-676; copy OFF-677; QA OFF-678; rollout approval OFF-679; deferred export OFF-680; beta feedback OFF-681.
- Read `docs/launch/readiness.md` and the [product guide](https://linear.app/off-brand-studio/document/komo-product-and-beta-launch-guide-6baf97d909c4). Search before creating. Use In Progress for active implementation, In Review for delivered work awaiting acceptance, Done only with evidence.
- Track release readiness, launch assets, and beta rollout separately. Use real dependencies and evidence-backed Done states. Merged code, published packages, deployed docs, and approved announcements are distinct milestones.
- Move active issues to In Progress; close the loop with evidence or an explicit blocker before ending work. Never post social content or merge a pull request without the owner's approval.

## Launch film

- Render source lives in `tools/launch-video/remotion`, a Remotion project outside the package workspace. Keep recording dependencies out of the npm package and production browser runtime.
- Use fixture feedback and the existing site/product components. The agent edits code; komo carries feedback. Keep that distinction visible.
- Rendered media stays in the sibling `../komo-promo/out/`, outside Git. Follow `tools/launch-video/remotion/README.md` for exact rendering and preview commands.
