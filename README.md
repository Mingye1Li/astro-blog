# 留白 · Private notes

A responsive Chinese-language GitHub Pages frontend using Supabase email/password authentication and a real Postgres backend. Users can create, read, edit, and delete their own notes.

## Backend

Connected project: `github-pages` (`meqykrquanvoapjphtun`). The `private_notes` table and four row-level security policies are already deployed. `supabase/schema.sql` documents the schema for a fresh project; do not rerun it on this configured project.

Only the publishable key belongs in `config.js`. Never put a Supabase secret/service-role key in browser code or GitHub. Anonymous database access is revoked. Every operation requires an authenticated user whose ID matches the note owner. Signing up does not grant access to anyone else's notes.

The GitHub Pages HTML, CSS, and JavaScript remain public. Private content must stay in the database, never in static files or the repository.

## Deploy

1. In GitHub repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
2. The included workflow publishes only `index.html`, `style.css`, `app.js`, and `config.js` after a push to `main`, or when run manually in Actions.
3. Expected project URL: `https://mingye1li.github.io/github-home/` (confirm the actual URL in the successful deployment).
4. In Supabase **Authentication → URL Configuration**, set the Site URL and an allowed redirect URL to that exact project URL, including `/github-home/`.
5. Keep Email authentication and email confirmation enabled. For public signups, configure custom SMTP: Supabase's built-in email service is limited to project-team email addresses and is unsuitable for general registration.

The repository is currently private. GitHub Pages from a private personal repository requires GitHub Pro; otherwise GitHub requires a public repository. Review that choice before changing repository visibility.

This app lets people register and stores notes separately for each user. For an invite-only space, disable new signups in Supabase and create/invite permitted users through the dashboard; existing users can still sign in.

## Verify

Serve this folder over HTTP (for example `python -m http.server 4174`); ES modules do not work by directly opening `index.html` as a file.

Run `supabase/tests/private_notes.sql` through the SQL editor or database tooling. It creates temporary test users and records inside a transaction, asserts owner CRUD, cross-user isolation, ownership-forgery rejection, and anonymous denial, then rolls everything back. The test passed against the connected project.

Browser verification covered rendering, module loading, and login error handling. A real signup/confirmation/login round trip still requires a user-controlled email and configured confirmation redirects. Supabase's security advisor reports that leaked-password protection is disabled; this feature requires a paid Supabase plan.
