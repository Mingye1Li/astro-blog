# 留白 · Private notes

A responsive Chinese-language Astro static site using Supabase email/password authentication, account approval, and a real Postgres backend. Approved users can create, read, edit, and delete their own notes.

## Development and build

Requires Node.js 22.22+ (CI uses Node 24) and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm preview
```

Astro generates the public HTML and optimized assets in `dist/`. The root page lives in `src/pages/index.astro`, with reusable UI in `src/components/` and the shared layout in `src/layouts/SiteLayout.astro`. Global CSS is bundled from `src/styles/global.css`. Supabase interactions run in the browser from `src/scripts/app.js`; the pinned Supabase SDK is bundled from the package lockfile, with no runtime CDN dependency. Private user data is never fetched at build time.

## Language and appearance

The header provides English / Simplified Chinese and System / Light / Dark selectors. i18next and i18next-browser-languagedetector detect the browser language, fall back to Simplified Chinese, and remember the choice in `liubai-language`. Translation resources live in `src/i18n/resources.js`. Static Astro copy and dynamic approval states, messages, action labels, and dates update in place without reloading or clearing a note draft. User-written notes and account emails are never translated.

theme-change persists explicit theme choices in `liubai-theme`; System clears that override and follows `prefers-color-scheme`. A small inline head script restores an explicit theme before paint. Both themes use shared CSS tokens, and explicit language/theme changes synchronize across tabs. If browser storage is blocked, theme changes work for the current page without persistence.

`pnpm test` checks translation coverage, English pluralization, and interpolation. GitHub Actions runs the tests before building.

## Markdown notes

Approved users write notes in EasyMDE, with formatting controls, keyboard shortcuts, undo/redo, and a rendered preview. Toolbar labels follow the selected language; the editor and previews use the site's light/dark theme tokens. The editor loads only when an approved user opens the workspace. Tab moves focus out of the editor.

The existing `private_notes.body` field stores the original Markdown source; no database migration is needed. Editing loads that source back into the editor. Marked renders both previews and saved note cards, then DOMPurify sanitizes the resulting HTML. Script/event-handler payloads, unsafe URLs, forms, embedded frames, and application-specific IDs/data attributes are removed. Plain-text notes remain readable, including line breaks. User Markdown is never sent to a conversion service.

EasyMDE's local autosave, remote spell-check dictionaries, and automatic icon downloads are disabled. Clearing an editor also clears its undo history. Notes retain the existing 20,000-character limit, with a visible counter and a validation message before saving oversized content. Markdown rendering and sanitization are covered by `tests/markdown.test.js`.

## Backend

Connected project: `github-pages` (`meqykrquanvoapjphtun`). The `private_notes` table and four row-level security policies are already deployed. `supabase/schema.sql` documents the schema for a fresh project; do not rerun it on this configured project.

Only the publishable key belongs in `src/lib/supabase-config.js`. Never put a Supabase secret/service-role key in browser code or GitHub. Anonymous database access is revoked. Every note operation requires a verified, approved user whose ID matches the note owner. Signing up does not grant access to notes.

## Roles and account approval

- New Auth users automatically receive `member` / `pending` through a database trigger, regardless of user metadata.
- After email confirmation, users can sign in and see their approval status. Pending or rejected accounts cannot read or write notes through the API.
- The owner account confirmed in chat has already been initialized as `admin` / `approved`. Sign in to the live site to see **账号审批**, where an administrator can approve, reject, revoke access, or return an application to pending.
- Ordinary members cannot list other accounts, approve themselves, change roles, or edit the permission table. Administrators manage access but cannot read other users' notes.
- Approval is read from the database for every note request, so revocation takes effect without waiting for a JWT refresh. The page refreshes access state every 30 seconds and when the window regains focus; already-viewed content cannot be recalled.
- Roles and statuses live in the unexposed `app_private.account_access` table with no direct client grants or RLS policies (intentional deny-all). Public RPC wrappers use invoker permissions, with authorization checks inside private functions. Owner administrator accounts cannot be disabled through the member-review endpoint.

`supabase/approval.sql` documents the approval extension for a fresh installation after `schema.sql`; it is already deployed here. It does not automatically nominate an administrator. On a fresh installation, a trusted operator must initialize a specific verified owner's row through the SQL editor before enabling the app. Never auto-promote the first signup or derive privileges from user-editable metadata.

The GitHub Pages HTML, CSS, and JavaScript remain public. Private content must stay in the database, never in static files or the repository.

## Deploy

1. In GitHub repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
2. After a push to `main` (or a manual run), the included workflow uses the official Astro action to install locked dependencies, run `pnpm build`, and upload the generated `dist/` folder to GitHub Pages. Source files and SQL scripts are not deployed.
3. Live project URL: `https://mingye1li.github.io/`. The first successful deployment is GitHub Actions run `39251187126`.
4. Supabase **Authentication → URL Configuration** is configured with the live project URL as both the Site URL and an allowed redirect URL, using the root `/` path.
5. Keep Email authentication and email confirmation enabled. For public signups, configure custom SMTP: Supabase's built-in email service is limited to project-team email addresses and is unsuitable for general registration.

The source repository is public, as approved, and Pages uses GitHub Actions. Supabase notes remain private to their owners.

This app accepts account applications and stores notes separately for each approved user. Approval is separate from Supabase email verification; both are required to access notes.

## Verify

Use `pnpm dev` during development. To verify the actual deployment output, run `pnpm build` followed by `pnpm preview`. Do not serve the source directory as a static site.

Run `supabase/tests/private_notes.sql` and `supabase/tests/approval.sql` through the SQL editor or database tooling. They create temporary users and records inside transactions and roll everything back. Tests cover owner CRUD, cross-user isolation, pending and rejected denial, signup defaults, metadata forgery, admin-only review, privilege escalation, administrator protection, and immediate revocation. Both suites passed against the connected project.

Browser verification covered rendering, module loading, and login error handling. A real signup/confirmation/login round trip still requires a user-controlled email and configured confirmation redirects. Supabase's security advisor reports that leaked-password protection is disabled; this feature requires a paid Supabase plan.
