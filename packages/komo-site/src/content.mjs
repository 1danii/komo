import { commentExample, promptExample } from "./feature-scenes.mjs";
import { scene } from "./scene.mjs";
import { connectExample } from "./connect-scene.mjs";
export const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export const code = (text, label = "Copy code") =>
  `<div class="install-wrap"><pre><code>${escape(text)}</code></pre><button class="copy-btn" data-copy="${escape(text)}" aria-label="${label}"><span data-icon="copy"></span></button></div>`;
const section = (title, body, id = "") =>
  `<section class="doc-section" ${id ? `id="${id}"` : ""}><h2>${title}</h2>${body}</section>`;
const frameworkTabs = `<div class="framework-tabs" data-framework-tabs>
 <div class="framework-tablist" role="tablist" aria-label="Framework example">
  <button class="framework-tab" id="framework-tab-react" role="tab" aria-selected="true" aria-controls="framework-panel-react">React</button>
  <button class="framework-tab" id="framework-tab-astro" role="tab" aria-selected="false" aria-controls="framework-panel-astro" tabindex="-1">Astro</button>
  <button class="framework-tab" id="framework-tab-js" role="tab" aria-selected="false" aria-controls="framework-panel-js" tabindex="-1">JavaScript</button>
 </div>
 <div class="framework-panel" id="framework-panel-react" role="tabpanel" aria-labelledby="framework-tab-react">${code("'use client';\nimport { useEffect } from 'react';\nimport { initKomo } from './komo.config.js';\n\nexport function Komo() {\n  useEffect(() => {\n    const komo = initKomo();\n    return () => komo.destroy();\n  }, []);\n  return null;\n}")}<p>Render <code>&lt;Komo /&gt;</code> once in your app or layout. Keep this component after connecting.</p></div>
 <div class="framework-panel" id="framework-panel-astro" role="tabpanel" aria-labelledby="framework-tab-astro" hidden>${code("<script>\n  import { initKomo } from './komo.config.js';\n  initKomo();\n</script>")}<p>With Astro’s client router, destroy the controller on <code>astro:before-swap</code>, then initialize on <code>astro:page-load</code>.</p></div>
 <div class="framework-panel" id="framework-panel-js" role="tabpanel" aria-labelledby="framework-tab-js" hidden>${code("import { initKomo } from './komo.config.js';\n\nconst komo = initKomo();")}<p>Run after your page mounts. Call <code>komo.destroy()</code> when removing the page.</p></div>
</div>`;
const inlineOptions = `<details class="faq"><summary>Already connected? Use inline options<span data-icon="plus"></span></summary><div><p>The generated helper keeps working. If you prefer inline options in React, replace the component above with <code>useKomo</code>. Use the project key printed in your terminal; never mount both.</p>${code("'use client';\nimport { useKomo } from '@tjcages/komo/react';\n\nexport function Komo() {\n  useKomo({ project: 'YOUR_PROJECT_KEY' });\n  return null;\n}")}<p>Other frameworks can call <code>initKomo({ project: 'YOUR_PROJECT_KEY' })</code> from <code>@tjcages/komo</code> instead.</p></div></details>`;
const agentPrompt =
  "Add komo to this website. Install @tjcages/komo, run `npx @tjcages/komo init --origin <dev server URL>` in the background, and mount initKomo() from ./komo.config.js on the client for dev and preview builds. Then ask me to choose Connect komo to sign in. Docs: https://komo.offbr.co/install/";
const promptCode = `<div class="install-wrap prompt-wrap"><pre><code>${escape(agentPrompt)}</code></pre><button class="copy-btn" data-copy="${escape(agentPrompt)}" aria-label="Copy agent prompt"><span data-icon="copy"></span></button></div>`;
export const pages = [
  {
    path: "/",
    label: "Overview",
    title: "Figma comments for any site",
    description:
      "Pin comments to anything on your website, discuss them with your team, and give your coding agent the context to make changes.",
    body: `
 <div class="home-intro" id="hero"><div class="hero-copy"><h1>Figma comments for any site</h1></div><div class="hero-aside"><p>Pin a comment to anything on your site. Talk it through with your team. Give your agent the context.</p>
 <div class="home-actions"><button class="pill" data-try-komo="#hero"><span data-icon="comment"></span> Leave a comment</button><button class="text-link copy-link" data-copy="${escape(agentPrompt)}"><span data-icon="copy"></span> Copy prompt</button></div>
 <div class="hero-cta-space" aria-hidden="true"></div></div></div>
 ${scene}
 <div class="home-install">${code("npm install @tjcages/komo", "Copy install command")}<span>Any website. Any framework.</span></div>
 <section class="tool-grid" aria-label="How komo works">
 <article class="tool-card"><div class="tool-card-bar"><span>01 / Comments</span><span data-icon="pointer"></span></div><div class="tool-card-body"><h2>Leave a comment. Right there.</h2><p>Pin a comment to a button, image, or area. Discuss it with your team, then resolve it when the work is done.</p>${commentExample}</div></article>
 <article class="tool-card"><div class="tool-card-bar"><span>02 / Agents</span><span data-icon="code"></span></div><div class="tool-card-body"><h2>Give your agent the context.</h2><p>Share your comments with the page, element, and replies attached. Your agent makes the changes; komo keeps the conversation in place.</p>${promptExample}<a class="text-link" href="/agent-prompts/">Explore the agent CLI <span data-icon="arrow"></span></a></div></article>
 <article class="tool-card"><div class="tool-card-bar"><span>03 / Setup</span><span data-icon="terminal"></span></div><div class="tool-card-body"><h2>Your site. Now with comments.</h2><p>Add komo to your app and connect once. Your teammates can sign in or leave their name to join the conversation.</p>${code("import { initKomo } from '@tjcages/komo';\ninitKomo({ project: 'YOUR_PROJECT_KEY' });")}<a class="text-link" href="/install/">Installation guide <span data-icon="arrow"></span></a></div></article>
 <article class="tool-card"><div class="tool-card-bar"><span>04 / Hosting</span><span data-icon="cloud"></span></div><div class="tool-card-body"><h2>A home for your comments.</h2><p>Start with komo hosting. No database or hosting to configure.</p><div class="feature-example usage-example" data-usage-demo role="button" tabindex="0" aria-label="Pause usage animation" aria-pressed="false"><div class="product-preview product-account" aria-label="Example starter plan usage"><div class="product-account-heading"><span data-icon="cloud"></span><strong>Starter plan</strong><span>Hosted</span></div><div class="product-usage"><span>Project comments</span><span><span><span data-usage-comments>42</span> / 250</span> <i class="product-ring" aria-hidden="true"></i></span></div><div class="product-usage"><span>Projects</span><span><strong data-usage-projects>1</strong> of 3</span></div><div class="product-slots" aria-hidden="true"><span class="filled"></span><span></span><span></span></div></div></div><div class="self-host-option"><span class="self-host-icon"><span data-icon="code"></span></span><div><strong>Prefer to self-host?</strong><p>Run the API in your own Cloudflare account or Node container. Your infrastructure’s limits apply.</p><a class="text-link" href="/hosting/#self-host">Self-hosting setup <span data-icon="arrow"></span></a></div></div></div></article>
 </section>
 <section class="try-section" aria-labelledby="try-heading"><div class="try-heading-row"><h2 id="try-heading">Try a comment. Right here.</h2></div><button id="try-komo" class="try-block" data-try-komo aria-label="Say hi 👋 — leave a comment"><span class="try-content"><span class="try-icon"><span data-icon="comment"></span></span><strong>Say hi 👋</strong><span class="try-caption">Click to leave a comment</span></span><span class="try-cursors" aria-hidden="true"><span class="try-cursor-track try-cursor-design"><span class="agent-cursor" data-agent="D"><span data-icon="multiplayer"></span></span></span><span class="try-cursor-track try-cursor-code"><span class="agent-cursor" data-agent="E"><span data-icon="multiplayer"></span></span></span><span class="try-cursor-track try-cursor-qa"><span class="agent-cursor" data-agent="P"><span data-icon="multiplayer"></span></span></span></span></button><p class="beta-badge">public beta</p></section>
`,
  },
  {
    path: "/install/",
    label: "Install",
    title: "Install komo.",
    description:
      "Add Figma-style comments to your website with komo. Install the package, mount it once, and connect from your site.",
    body: `<h1>Install komo.</h1><p class="lede">Paste this prompt into your coding agent, or follow the steps below. Works with React, Astro, Vue, and plain JavaScript.</p>
 ${promptCode}
 <p class="manual-note">Or install manually. Requires Node.js 22 or newer.</p>
 ${section("01 · Install the package", code("npm install @tjcages/komo"))}
 ${section("02 · Create your project", `${code("npx @tjcages/komo init")}<p>Keep this terminal open while you start your app in another terminal.</p>`)}
 ${section("03 · Add komo to your app", `<p>Setup creates <code>komo.config.js</code> and updates it automatically when you connect. Choose your framework and adjust the import path to that file.</p>${frameworkTabs}`)}
 ${section("04 · Connect from your site", `<p>Open your app and choose <strong>Connect komo</strong> in the sidebar. Review your site addresses, then sign in with Google. Setup saves your project automatically—you’re ready to comment.</p>${connectExample}<p>Share your preview with a teammate. They can leave their name to reply, or sign in with Google.</p>${inlineOptions}`)}
 ${section("Keep it on preview builds", `<p>Pass your framework’s public environment flag to the same mount:</p>${code("initKomo({\n  enabled: import.meta.env.DEV ||\n    import.meta.env.PUBLIC_PREVIEW === 'true',\n});")}<p>Using <code>useKomo</code>? Add <code>enabled</code> to its options instead.</p><a class="text-link" href="/configuration/">Configuration options <span data-icon="arrow"></span></a>`)} `,
  },
  {
    path: "/configuration/",
    label: "Configuration",
    title: "Configuration.",
    description:
      "Configure project and branch scope, preview environments, source links, and reviewer sessions.",
    body: `<h1>Configuration.</h1><p class="lede">Pass your project key and any options when you initialize komo.</p><p><code>YOUR_PROJECT_KEY</code> is a placeholder for a string. For hosted komo, copy the key returned by <code>komo init</code>. For self-hosting, use the project identifier configured on your server. Reuse the same key wherever you want to share feedback.</p>${code("import { initKomo } from '@tjcages/komo';\n\ninitKomo({\n  project: 'YOUR_PROJECT_KEY',\n  pageRoot: document.querySelector('#app'),\n  scope: 'branch',\n  branch: 'preview/navigation',\n});")}
 ${section(
   "Client options",
   `<div class="table-scroll"><table><thead><tr><th>Option</th><th>Type</th><th>Default / behavior</th></tr></thead><tbody>${[
     ["endpoint", "string", "Hosted komo API by default. Override for self-hosting."],
     ["project", "string", "Required. Use the string returned by setup. Public, not a credential."],
     [
       "repo", "string",
       "Defaults to the project key. Pass owner/repo to enrich agent prompts.",
     ],
     [
       "scope", "\"project\" | \"branch\"",
       "project: feedback shared across deployments. Use branch to isolate it.",
     ],
     [
       "branch", "string",
       "Detected at build time by komo sync when branch scope is enabled.",
     ],
     ["enabled", "boolean", "true. Set false to omit the widget."],
     [
       "pageRoot", "HTMLElement",
       "Mounted content root for Frame. Defaults to a sole existing content element; multiple roots use Floating until pageRoot is set.",
     ],
     ["page", "() => string", "Current pathname. Query strings and fragments excluded."],
     ["drawerContainer", "HTMLElement", "Optional element to center the drawer within."],
     ["autoHideDrawer", "boolean", "true. Set false to keep the drawer visible."],
     [
        "sidebar", "\"background\" | \"edge\"",
        "\"edge\" (default) is a floating sidebar. \"background\" frames the page. Account → Sidebar switches Floating and Frame.",
     ],
     ["pollInterval", "number", "4000 ms while the page is visible."],
     ["source", "(element: Element) => string | undefined", "Element → repository-relative source file path."],
     ["sourceUrl", "(source: string, branch: string) => string", "Source path and branch → editor or repository URL."],
     [
       "sessionDomain", "string",
       "Optional parent domain you own. Never a public suffix.",
     ],
   ]
     .map(([k, type, v]) => `<tr><td><code>${k}</code></td><td><code>${escape(type)}</code></td><td>${v}</td></tr>`)
     .join("")}</tbody></table></div>`
 )}
 ${section("Branch scope", `${code("npx @tjcages/komo init --branch-scope")}<p>Use this when feedback belongs to a particular change. Without it, matching page paths share comments across deployments.</p><p>For automatic branch detection, import <code>initKomo</code> from the optional generated <code>komo.config.js</code> helper and run <code>komo sync</code> before your build. It checks deployment environment variables and Git. Set <code>KOMO_BRANCH</code> when neither can identify the branch.</p>`)}
 ${section("Source links", `${code("initKomo({\n  project: 'YOUR_PROJECT_KEY',\n  source: element => element.closest('[data-source]')\n    ?.getAttribute('data-source') ?? undefined,\n});")}<p>Add <code>data-source="src/components/Hero.tsx"</code> to an element to include that file in copied feedback. Source references are provided by your site; komo does not upload your code.</p>`)}
 ${section("Lifecycle", `${code("const review = initKomo({ project: 'YOUR_PROJECT_KEY' });\nreview.open();    // Open the sidebar\nreview.close();   // Close it\nawait review.refresh();\nreview.destroy();")}<p>Destroy the instance when your application unmounts. Repeated initialization in the same document reuses the existing instance.</p>`)} `,
  },
  {
    path: "/hosting/",
    label: "Hosting & limits",
    title: "A home for your comments.",
    description:
      "Start with hosted komo, or run the API on Cloudflare or a Node container.",
    body: `<h1>A home for your comments.</h1><p class="lede">Keep your comments and conversations together, separate from your site’s code. Choose where they live.</p>
 ${section("Hosted starter", `<div class="quota-demo"><div><strong>3</strong><span>projects per Google owner</span></div><div><strong>250</strong><span>comments per project</span></div></div><p>The hosted starter is currently free during beta. The account panel shows your usage. Replies, resolved comments, and deleted comments count toward the stored-comment limit.</p><p>Each workspace also has a 10 MiB logical storage budget and a 500-write daily limit. Rate limits protect the shared service. There is no automatic paid upgrade.</p><p>A Google-authenticated owner creates and manages the project. Guests can participate, but cannot own a workspace.</p>`)}
 ${section("Self-hosted", `${code("npx @tjcages/komo init --self-host \\\n  --google-client-id YOUR_GOOGLE_CLIENT_ID")}<p>The CLI signs into Cloudflare, creates a D1 database, runs migrations, and deploys a Worker. It prompts for your Google client secret through Wrangler.</p><p>Add the printed callback URL in Google Console, then open the owner-claim link and sign in. Keep the local owner key private.</p>${code("npx @tjcages/komo deploy")}<p>Update the npm package first, then use this to resume or redeploy an existing setup. The command copies new migrations and applies them before deploying. Your infrastructure follows your Cloudflare account’s limits and billing. komo does not impose the hosted starter quotas.</p>`, "self-host")}
 ${section("Node container + PostgreSQL", `<p>Run the same comments API on your own container platform, including Cloud Run. Provide PostgreSQL, an API URL, and approved preview origins. The widget and agent CLI keep the same protocol; existing Cloudflare installations do not change.</p>${code("npx komo init --node \\\n  --endpoint https://comments.example.com \\\n  --preview-origin \"https://pr-*.preview.example.com\" \\\n  --google-client-id YOUR_CLIENT_ID")}<p>The container applies its database schema at startup. Configure Google sign-in for private reviews, or allow guest reviews on approved sites. <a href="https://github.com/tjcages/komo/blob/2c0d151edd6fe8f185a39b9dedfe2a4234bcb83f/packages/komo/NODE.md">Node self-hosting guide</a> covers setup and bot commands.</p>`)}
 ${section("What a shared link means", `<p>Projects start with link access. Owners can switch to invited Google accounts in Account → Project settings. Invitation links are tied to an email address, expire after seven days, and work once. Approved sites control embedding; membership controls access to private feedback.</p><p>Site approval lets komo load; signing in identifies the reviewer. For the same komo project, previews in one Cloudflare Workers account or Pages project share sign-in. Unrelated domains require their own sign-in unless you configure a trusted parent with <code>sessionDomain</code>.</p>`)}
 ${section("Move your feedback", `<p>Export from your current project, create a self-hosted project in a separate directory, then import there after signing in as its owner.</p>${code("npx @tjcages/komo project export --out comments.json\n# From your destination project:\nnpx @tjcages/komo login\nnpx @tjcages/komo project import --file /path/to/comments.json")}<p>Comments, replies, reactions, positions, and resolved states carry over. Imported authors are historical, unverified identities; credentials and memberships never move. Keep the same file to safely retry an interrupted import. Your source stays unchanged until you choose to delete it.</p>`, "migration")}
 ${section("When a project fills up", `<p>Existing feedback stays readable. In Account → Project settings, download your comments, then clear resolved threads to reclaim space. In the sidebar’s Resolved view, the trash button deletes only the currently filtered threads and their replies after confirmation. Export first: clearing threads is permanent. Owners can also delete a hosted project to free a project slot.</p>`)} `,
  },
  {
    path: "/agent-prompts/",
    label: "For your agent",
    title: "Give your agent the context.",
    description:
      "Read, reply to, and resolve website comments from your coding agent with the komo CLI.",
    body: `<h1>Your comments.<br>Your agent’s next task.</h1><p class="lede">Turn a comment on your site into a clear task, with the page, element, and conversation attached.</p>
 ${section("From a comment to a fix", `<p>Update komo, then sign in once from your project. Your setup settings carry over.</p>${code("npm install @tjcages/komo@latest\nnpx @tjcages/komo login\nnpx @tjcages/komo comments list\nnpx @tjcages/komo comments get THREAD_ID")}<p>Your agent gets the page, selector, source reference, and replies as JSON. After making and checking a change, it can close the loop.</p>${code('npx @tjcages/komo comments reply THREAD_ID --body "Fixed."\nnpx @tjcages/komo comments resolve THREAD_ID')}`, "cli")}
 ${section("Default comment workflow", `<p>New projects get comment instructions in <code>AGENTS.md</code>. Add them to an existing project with:</p>${code("npx @tjcages/komo agents setup")}<p>Agents read comments and replies before editing. Simple fixes can be resolved after verification at 90%+ confidence. Questions and changes that need review stay open with a reply.</p>`)}
 ${section("Built for agents", `<p>Run <code>komo schema</code> for a machine-readable command reference. Commands can create comments, edit your messages, react, move anchors, and reopen threads.</p><p>Use <code>--page /pricing</code> to focus on one page, or <code>--status resolved</code> to revisit completed feedback. Long replies can come from a file or standard input.</p>${code("npx @tjcages/komo comments reply THREAD_ID --body-file reply.md\nnpx @tjcages/komo comments prompt --page /pricing")}<p>Google sign-in saves a project session on your computer, outside the repository. Automated environments can use <code>KOMO_TOKEN</code>. The same comment permissions and limits apply.</p>`)}
 ${section("Share your comments", `<p>Choose <strong>Copy all comments</strong> from the expanded drawer for open feedback across the project. The sidebar’s copy button exports only the current page.</p><p>Paste it into Codex, Claude Code, Cursor, or another agent with access to your repository. Resolved threads stay out of the prompt.</p>`)}
 ${section("The useful details", `<ul class="clean-list"><li>Your feedback and the replies that clarify it</li><li>Repository, scope, and page URL</li><li>The element’s selector and visible text</li><li>The comment position or selected area</li><li>Source file references, when supplied by your site</li></ul>`)}
 ${section("A comment becomes a task", `${code("Page: /pricing\nTarget: #annual-plan-button\nElement text: Choose plan\nSource: src/components/Pricing.tsx\n\nMaya: Make it clear this is billed annually.\nAlex: Keep the monthly equivalent visible too.")}<p>komo copies context for your agent; it does not run an agent, upload your repository, or make code changes itself.</p>`)} `,
  },
  {
    path: "/faq/",
    label: "Questions",
    title: "Questions.",
    description:
      "Answers about komo, guests, authentication, storage, privacy, and framework support.",
    body: `<h1>Questions.</h1>${[
      [
        "What is komo?",
        "Figma comments for any site. Add komo to your app, pin a comment to an element or area, and discuss it with your team. Share the comments and their context with your coding agent when you’re ready to make changes.",
      ],
      [
        "Is this tied to a framework?",
        "No. komo mounts in the browser and keeps its UI in an isolated ShadowRoot. Your site can use React, Astro, Vue, or plain JavaScript.",
      ],
      [
        "Does everyone need a Google account?",
        "The project owner does. Reviewers can sign in with Google or enter a display name as a guest. A guest name is not a verified identity.",
      ],
      [
        "Will comments follow a new deployment?",
        "By default, yes: feedback is shared by project and page path. Enable branch scope if you want separate feedback for each branch. Element anchors work best with stable IDs or selectors.",
      ],
      [
        "Can I leave comments on mobile?",
        "The widget responds to smaller viewports, but precise element selection and drag controls work best with a pointer.",
      ],
      [
        "What happens if a save fails?",
        "Your action appears immediately. If the service rejects the save, komo restores the prior state and shows a notice. Unsaved comment text is kept for recovery.",
      ],
      [
        "Is feedback private?",
        "Projects start with link access. The Google owner can restrict feedback to invited Google accounts in Project settings. Website access and repository permissions remain separate.",
      ],
      [
        "Can I use it in production?",
        "You control where it mounts. We recommend preview and development environments while the hosted service is in beta.",
      ],
      [
        "How do I delete or export my account?",
        "Owners can download feedback and delete hosted projects in Account → Project settings. For account-wide data or deletion requests, contact ty@offbr.co.",
      ],
    ]
      .map(
        ([q, a]) =>
          `<details class="faq"><summary>${q}<span data-icon="plus"></span></summary><div><p>${a}</p></div></details>`
      )
      .join("")}`,
  },
  {
    path: "/privacy/",
    label: "Privacy",
    title: "Privacy.",
    description:
      "What komo stores, who can see your feedback, and how to contact Off brand about your data.",
    body: `<div class="eyebrow">Last updated September 16, 2026</div><h1>Privacy.</h1><p class="lede">komo is operated by Off brand. Questions about your data? Contact <a href="mailto:ty@offbr.co">ty@offbr.co</a>.</p>
 ${section("What the hosted service stores", `<p>We store your comments, replies, reactions, selected element references and positions, page paths, project settings, approved site addresses, and timestamps. Element text and source file references may be included when you select an element. We do not upload your repository or automatically capture screenshots.</p><p>Google sign-in supplies a stable account identifier, verified email address, display name, and profile photo. Verified email addresses match private invitations and are visible to project owners. Guest accounts store the display name you choose. Profile changes can include an uploaded, resized avatar and accent color.</p>`)}
 ${section("Why we use it", `<p>This information supports shared reviews, account authentication, ownership, usage limits, and abuse prevention. Sessions, hashed authentication tokens, rate-limit records, and service diagnostics support operation and troubleshooting.</p><p>The hosted service runs on Cloudflare Workers and D1. Google processes Google sign-in. Their services have their own privacy policies.</p>`)}
 ${section("Who can see feedback", `<p>Feedback is available to people who can access the configured review workspace. Display names, avatars, comments, and replies are visible to other reviewers. komo does not enforce your Git repository’s permissions.</p><p>Do not place secrets or sensitive personal information in comments or selected page content. Secure private previews using your own access controls.</p>`)}
 ${section("Cookies and local storage", `<p>The widget stores a reviewer session in a cookie and local storage until you sign out, with the cookie capped at the browser’s 400-day maximum. It also stores preferences such as drawer position and emoji history. Sign-out revokes the current service session. Cookies are used for authentication, not advertising.</p><p>The animated walkthrough is scripted. Comments you leave on this website are public and shared with other visitors. The public demo keeps each reviewer’s latest three comments and removes older ones when they post again.</p>`)}
 ${section("Retention and requests", `<p>Hosted feedback remains until removed by its owner or through service administration. Owners can export feedback, permanently clear resolved threads, or delete a hosted project. Deleting a comment in the widget replaces its text with a deletion marker; associated records may remain and continue counting toward quota. Resolved comments are retained.</p><p>For an account data copy, correction, or deletion request, email <a href="mailto:ty@offbr.co">ty@offbr.co</a> from an address that can help establish ownership. We may need to verify your identity before fulfilling a request.</p><p>Self-hosted data belongs to the operator of that deployment. Contact that operator about its retention and access rules.</p>`)} `,
  },
  {
    path: "/terms/",
    label: "Terms",
    title: "Using komo.",
    description:
      "Conditions for using the komo hosted beta and the open-source package.",
    body: `<div class="eyebrow">Last updated September 16, 2026</div><h1>Using komo.</h1><p class="lede">komo helps teams discuss websites. Use it on projects you are authorized to review.</p>
 ${section("The package and the service", `<p>The npm package is provided under the MIT license included with the package. These service terms describe the separate hosted beta operated by Off brand.</p><p>The hosted beta provides up to three projects per Google owner and 250 stored comments per project, subject to additional storage, request, and abuse limits. Availability, limits, and features may change. Paid upgrades are not currently offered.</p>`)}
 ${section("Your content and responsibilities", `<p>You keep ownership of your feedback. You permit the service to store, process, and display it to provide your review workspace. Share only content you have permission to share.</p><p>Keep your Google account and local setup credentials secure. Approve only sites you trust. You are responsible for restricting access to private previews and for the actions of people who use your workspace.</p>`)}
 ${section("Acceptable use", `<p>Do not use komo to store unrelated bulk data, distribute unlawful content, harass others, attack infrastructure, evade limits, or access another person’s account without permission. We may restrict or suspend abusive use.</p>`)}
 ${section("Beta availability", `<p>The hosted service is provided as available, without a service-level commitment. Keep independent records of work you need to retain. Owners can export feedback from their account panel or CLI and import it into another komo deployment. Contact us for account-wide data requests.</p><p>Nothing on this page limits rights that cannot be limited under applicable law. Self-hosted deployments remain the responsibility of their operators.</p>`)}
 ${section("Contact", `<p>For support, access issues, or data requests, email <a href="mailto:ty@offbr.co">ty@offbr.co</a>. See the <a href="/privacy/">privacy page</a> for details about stored information.</p>`)} `,
  },
];
