create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;
create table app_private.account_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('admin','member')),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null
);
alter table app_private.account_access enable row level security;
revoke all on app_private.account_access from public, anon, authenticated;
create function app_private.create_pending_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into app_private.account_access(user_id) values (new.id) on conflict do nothing;
 return new;
end $$;
revoke all on function app_private.create_pending_account() from public, anon, authenticated;
create trigger create_pending_account after insert on auth.users for each row execute function app_private.create_pending_account();
insert into app_private.account_access(user_id) select id from auth.users on conflict do nothing;

create function app_private.has_access() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
 select 1 from app_private.account_access a join auth.users u on u.id=a.user_id
 where a.user_id=auth.uid() and a.status='approved'
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false));
$$;
create function app_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and app_private.has_access() and exists (
 select 1 from app_private.account_access where user_id=auth.uid() and role='admin');
$$;
create function app_private.my_access() returns table(role text,status text)
language sql stable security definer set search_path = '' as $$
 select a.role,a.status from app_private.account_access a where auth.uid() is not null and a.user_id=auth.uid();
$$;
create function app_private.list_accounts() returns table(user_id uuid,email text,role text,status text,created_at timestamptz,email_confirmed boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not app_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select a.user_id,u.email::text,a.role,a.status,a.created_at,(u.email_confirmed_at is not null)
 from app_private.account_access a join auth.users u on u.id=a.user_id order by a.created_at desc;
end $$;
create function app_private.review_account(target_user_id uuid,new_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not app_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if new_status not in ('approved','rejected','pending') or new_status is null then raise exception 'Invalid status' using errcode='22023'; end if;
 update app_private.account_access set status=new_status,reviewed_at=now(),reviewed_by=auth.uid()
 where user_id=target_user_id and user_id<>auth.uid() and role='member';
 if not found then raise exception 'Account not found or protected administrator' using errcode='22023'; end if;
end $$;
revoke all on function app_private.has_access(),app_private.is_admin(),app_private.my_access(),app_private.list_accounts(),app_private.review_account(uuid,text) from public, anon;
grant execute on function app_private.has_access(),app_private.is_admin(),app_private.my_access(),app_private.list_accounts(),app_private.review_account(uuid,text) to authenticated;

create function public.get_my_access() returns table(role text,status text)
language sql stable security invoker set search_path = '' as $$ select * from app_private.my_access(); $$;
create function public.list_accounts() returns table(user_id uuid,email text,role text,status text,created_at timestamptz,email_confirmed boolean)
language sql stable security invoker set search_path = '' as $$ select * from app_private.list_accounts(); $$;
create function public.review_account(target_user_id uuid,new_status text) returns void
language sql security invoker set search_path = '' as $$ select app_private.review_account(target_user_id,new_status); $$;
revoke all on function public.get_my_access(),public.list_accounts(),public.review_account(uuid,text) from public,anon;
grant execute on function public.get_my_access(),public.list_accounts(),public.review_account(uuid,text) to authenticated;

alter policy notes_select on public.private_notes using ((select auth.uid())=user_id and (select app_private.has_access()));
alter policy notes_insert on public.private_notes with check ((select auth.uid())=user_id and (select app_private.has_access()));
alter policy notes_update on public.private_notes using ((select auth.uid())=user_id and (select app_private.has_access())) with check ((select auth.uid())=user_id and (select app_private.has_access()));
alter policy notes_delete on public.private_notes using ((select auth.uid())=user_id and (select app_private.has_access()));
