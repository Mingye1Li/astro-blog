-- Existing notes remain private; only an explicit owner save publishes a post.
alter table public.private_notes add column is_published boolean not null default false;
alter table public.private_notes add column published_at timestamptz;
create function app_private.set_publication_time() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not new.is_published then new.published_at := null;
  elsif TG_OP = 'INSERT' then new.published_at := now();
  elsif not old.is_published then new.published_at := now();
  else new.published_at := old.published_at;
  end if;
  return new;
end $$;
revoke all on function app_private.set_publication_time() from public, anon, authenticated;
create trigger set_publication_time before insert or update on public.private_notes
for each row execute function app_private.set_publication_time();
alter table public.private_notes add constraint publication_time_consistent
check (is_published = (published_at is not null));
create index private_notes_published_idx on public.private_notes(published_at desc, id) where is_published;
grant select(id,title,body,created_at,is_published,published_at) on public.private_notes to anon;
create policy published_posts_select on public.private_notes for select to anon, authenticated using (is_published);
