-- Stable readable URLs. UUID suffix makes concurrent duplicate titles safe.
alter table public.private_notes add column slug text;
create function app_private.set_post_slug() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and old.slug is not null then
    new.slug := old.slug;
  else
    new.slug := coalesce(nullif(trim(both '-' from left(regexp_replace(lower(new.title), '[^a-z0-9一-鿿]+', '-', 'g'), 70)), ''), 'post') || '-' || new.id::text;
  end if;
  return new;
end $$;
revoke all on function app_private.set_post_slug() from public, anon, authenticated;
create trigger set_post_slug before insert or update on public.private_notes
for each row execute function app_private.set_post_slug();
update public.private_notes set slug = null where slug is null;
alter table public.private_notes alter column slug set not null;
alter table public.private_notes add constraint private_notes_slug_key unique(slug);
grant select(slug) on public.private_notes to anon;
