# GitHub project integration

Project owners connect GitHub in **Account → Project settings** of the standalone `/setup?project=PROJECT_KEY` screen. Hosted owners use `/setup?workspace=WORKSPACE_ID`. The flow is per project:

1. **Connect GitHub** opens one popup. GitHub asks for authorization once. If the App is not installed yet, the popup continues to GitHub's install page, where the owner chooses the account or organization and the repositories.
2. The popup closes and the owner selects a **Repository**. The selection saves immediately.
3. **Manage access** opens GitHub's install page in the same popup to add an account or change repository access.
4. **Disconnect** removes the connection from this project only. The App stays installed on GitHub.

Owners and explicitly invited project members can create an issue from an open thread using the GitHub button next to Resolve. The issue contains the discussion and a link back to the thread. On success, komo resolves the thread and shows “Continues in owner/repo#number.” The thread stays an ordinary thread: it can be reopened, replied to, and edited. Public-link visitors cannot create issues. The issue repository is separate from the project's source repository configuration.

## Development-only App registration

[Register komo-dev-dani with prefilled development settings](https://github.com/settings/apps/new?name=komo-dev-dani&description=Development-only%20komo%20issue%20creation&url=http%3A%2F%2Flocalhost%3A8788%2Fsetup&callback_urls%5B%5D=http%3A%2F%2Flocalhost%3A8788%2Fauth%2Fgithub-app%2Fcallback&setup_url=http%3A%2F%2Flocalhost%3A8788%2Fauth%2Fgithub-app%2Fsetup&setup_on_update=true&request_oauth_on_install=false&public=false&webhook_active=false&metadata=read&issues=write).

Review these values before creating the App:

- Name: `komo-dev-dani` (choose another development name if unavailable).
- Homepage: `http://localhost:8788/setup`.
- Callback URL: `http://localhost:8788/auth/github-app/callback`.
- Setup URL: `http://localhost:8788/auth/github-app/setup`, with **Redirect on update** checked. GitHub returns here after installing or changing repository access.
- Leave **Request user authorization (OAuth) during installation** unchecked. komo starts its own state-bound authorization.
- Webhooks: inactive.
- Repository permissions: **Issues: read and write**, plus required **Metadata: read-only**. Leave all other permissions unset.
- Installation availability: **Only on this account** restricts installation to the App owner. To install into another organization, choose **Any account** or register a private development App under that organization. Do not install on upstream `tjcages/komo`.

An existing development App needs the Setup URL and **Redirect on update** added in its settings.

GitHub has no create-only issue permission: [creating an issue requires Issues write](https://docs.github.com/en/rest/issues/issues#create-an-issue). komo only creates issues.

## Local configuration

Place these values in the ignored `packages/komo/server/.dev.vars`:

```dotenv
GITHUB_APP_ID=<numeric App ID>
GITHUB_APP_SLUG=<slug from the App URL>
GITHUB_APP_CLIENT_ID=<App client ID>
GITHUB_APP_CLIENT_SECRET=<generated App client secret>
GITHUB_APP_PRIVATE_KEY="<PEM with escaped \\n line breaks>"
```

Keep secrets out of Git and chat. These credentials are separate from reviewer sign-in's `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. Restart the local API with `sh packages/komo/server/start-local.sh`.

## Backend behavior

- Only a Google-authenticated owner of the project can read or change its integration.
- Authorization is bound to that owner's session, project, origin, one-use state, browser cookie, and PKCE verifier. The setup URL never trusts GitHub's `installation_id`; it authorizes again and lists the installations GitHub grants to that person.
- komo stores no GitHub user tokens. The user token is used once to verify installations and is discarded. The project stores the GitHub login, the verified installations, and the selected repository.
- Repository lists and issue creation use short-lived installation tokens signed with the App's private key. Issue tokens are scoped to the selected repository and Issues write. Issues are authored by the App bot.
- Selecting a repository proves access by requesting an issue token for that repository. Archived repositories and repositories with issues disabled are rejected.
- Reconnecting keeps the selection only while its installation is still verified for the connecting person.
- Access is checked when settings load. No webhooks or background sync are included.
- If GitHub reports that an installation no longer exists (404 when requesting its token), komo removes it from the project, as GitHub's `installation.deleted` webhook would. Without remaining installations the project is disconnected and settings show “GitHub access was removed.” Issue links are kept.
- A repository removed from an installation stays selected and is shown as unavailable, so the owner can restore access or choose another repository.
- Invalid App credentials (401), suspended installations (403), and GitHub outages never disconnect a project.

## Issue creation

A per-thread reservation stops double submission. Every failure releases it and leaves the thread open, so the member can try again. A reservation abandoned by a crashed request expires after 60 seconds. If GitHub creates the issue but its response is lost, a retry can create a duplicate issue. komo accepts this rare case instead of locking the thread. The server never truncates long discussions; discussions over GitHub's body limit are rejected.

Issue links survive disconnection and repository changes. Completed links are included in the optional `github_issues` export/import table. Old exports remain accepted.

## Database and verification

D1 uses migrations `0016_github_integration.sql` and `0017_github_issues.sql`. PostgreSQL startup applies `002_github_integration.sql` and `003_github_issues.sql` (schema version 3). Apply migrations before deploying the API. Integration settings are excluded from the embedded widget bundle; the issue action is part of the widget.

`test/github-integration.test.ts` covers authorization, installation handoff, repository validation, bot tokens, issue creation, failure recovery, and export/import with real SQLite migrations and mocked GitHub responses.

References: [setup URL](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url), [registration URL parameters](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-using-url-parameters), [user authorization](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app), [installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app).
