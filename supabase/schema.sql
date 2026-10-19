-- Reference schema for a fresh project. Already deployed to the connected project.
create table public.private_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 20000),
  created_at timestamptz not null default now()
);
create index private_notes_user_id_idx on public.private_notes(user_id);
alter table public.private_notes enable row level security;
revoke all on public.private_notes from anon, authenticated;
grant select, insert, update, delete on public.private_notes to authenticated;
create policy notes_select on public.private_notes for select to authenticated
using ((select auth.uid()) = user_id);
create policy notes_insert on public.private_notes for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy notes_update on public.private_notes for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy notes_delete on public.private_notes for delete to authenticated
using ((select auth.uid()) = user_id);
