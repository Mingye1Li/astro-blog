# 留白 · Private notes

A responsive Chinese-language GitHub Pages frontend using Supabase email/password authentication, account approval, and a real Postgres backend. Approved users can create, read, edit, and delete their own notes.

## Backend

Connected project: `github-pages` (`meqykrquanvoapjphtun`). The `private_notes` table and four row-level security policies are already deployed. `supabase/schema.sql` documents the schema for a fresh project; do not rerun it on this configured project.

Only the publishable key belongs in `config.js`. Never put a Supabase secret/service-role key in browser code or GitHub. Anonymous database access is revoked. Every note operation requires a verified, approved user whose ID matches the note owner. Signing up does not grant access to notes.

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
2. The included workflow publishes only `index.html`, `style.css`, `app.js`, and `config.js` after a push to `main`, or when run manually in Actions.
3. Live project URL: `https://mingye1li.github.io/github-home/`. The first successful deployment is GitHub Actions run `39251187126`.
4. Supabase **Authentication → URL Configuration** is configured with the live project URL as both the Site URL and an allowed redirect URL, including `/github-home/`.
5. Keep Email authentication and email confirmation enabled. For public signups, configure custom SMTP: Supabase's built-in email service is limited to project-team email addresses and is unsuitable for general registration.

The source repository is public, as approved, and Pages uses GitHub Actions. Supabase notes remain private to their owners.

This app accepts account applications and stores notes separately for each approved user. Approval is separate from Supabase email verification; both are required to access notes.

## Verify

Serve this folder over HTTP (for example `python -m http.server 4174`); ES modules do not work by directly opening `index.html` as a file.

Run `supabase/tests/private_notes.sql` and `supabase/tests/approval.sql` through the SQL editor or database tooling. They create temporary users and records inside transactions and roll everything back. Tests cover owner CRUD, cross-user isolation, pending and rejected denial, signup defaults, metadata forgery, admin-only review, privilege escalation, administrator protection, and immediate revocation. Both suites passed against the connected project.

Browser verification covered rendering, module loading, and login error handling. A real signup/confirmation/login round trip still requires a user-controlled email and configured confirmation redirects. Supabase's security advisor reports that leaked-password protection is disabled; this feature requires a paid Supabase plan.
