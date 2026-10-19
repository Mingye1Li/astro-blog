# Astro Blog — Liubai

Astro renders the public blog on request. Cloudflare Workers Free hosts the site; Supabase continues to provide authentication, approval roles, and post storage. GitHub stores source code and runs validation. Cloudflare Git integration builds and deploys main.

Repository: https://github.com/Mingye1Li/astro-blog
Local project: E:/git_repo/astro-blog
Live blog: https://liubai-blog.mingye-li1.workers.dev/blog/

The separate E:/git_repo/github-home directory and Mingye1Li/mingye1li.github.io repository are reserved for a future GitHub Pages site.

## Development and deployment

Use Node 24 and pnpm 11.25.0. Run `pnpm install`, `pnpm test`, and `pnpm build`. Use `pnpm dev` during development or `pnpm exec wrangler dev` after a build to test the production Worker. Deploy with `pnpm exec wrangler deploy`, or the connected Cloudflare build.

Cloudflare build command: `pnpm test && pnpm build`. Deploy command: `pnpm exec wrangler deploy`. Set NODE_VERSION=24 and PNPM_VERSION=11.25.0 in build variables. No secret database key is needed. Only the publishable Supabase key is used; public server requests never forward a user's authenticated session.

## Pages

- `/` and `/blog/`: published titles and Markdown-derived summaries, 12 per page.
- `/blog/<slug>/`: individual post, with stable title-derived slug and a UUID suffix to avoid collisions. Title edits retain the URL. Private or missing posts return 404. Backend outages return 503.
- `/notes/`: approved users manage their own private or published posts.
- `/admin/`: administrators approve/reject accounts.
- `/login/`: returns to the requested allowed internal page after login.

Public HTML uses Cache-Control: no-store so unpublishing is reflected on the next request. Readers may retain copies of previously published content. Markdown rendering is sanitized; the server includes escaped Markdown as a readable fallback before JavaScript enhances it. English/Chinese preferences and system/light/dark themes are preserved.

## Database setup

On a new Supabase project, apply schema.sql, approval.sql, blog.sql, then post-slugs.sql in that order. These have already been applied to the existing project. Never expose a service-role key. Database RLS enforces owner CRUD, approved access, and anonymous read-only access to published posts. New accounts remain pending until an administrator approves them.

The SQL tests under supabase/tests run fixtures inside transactions and roll them back. Node tests cover localization, Markdown sanitization, summaries, and login return paths.

After changing the production domain, set Supabase Auth Site URL and allowed redirect URLs to the new origin and `/login/` URL. Existing browser sessions are tied to the old origin, so users sign in again on the new domain.
