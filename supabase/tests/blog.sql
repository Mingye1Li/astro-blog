begin;
insert into auth.users(id,email,email_confirmed_at) values
('11111111-1111-4111-8111-111111111111','blog-owner@example.invalid',now()),
('22222222-2222-4222-8222-222222222222','blog-other@example.invalid',now());
update app_private.account_access set status='approved' where user_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
insert into public.private_notes(id,title,body) values ('33333333-3333-4333-8333-333333333333','Blog privacy fixture','**Private**');
do $$ begin
 if not exists(select 1 from public.private_notes where id='33333333-3333-4333-8333-333333333333' and not is_published and published_at is null) then raise exception 'Default is not private'; end if;
end $$;
set local role anon;
do $$ begin
 if exists(select id from public.private_notes where id='33333333-3333-4333-8333-333333333333') then raise exception 'Private post leaked'; end if;
 begin perform user_id from public.private_notes; raise exception 'Owner IDs exposed to anon'; exception when insufficient_privilege then null; end;
 begin insert into public.private_notes(title,is_published) values ('forged',true); raise exception 'Anonymous insert allowed'; exception when insufficient_privilege then null; end;
 begin update public.private_notes set is_published=true; raise exception 'Anonymous update allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.private_notes; raise exception 'Anonymous delete allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
update public.private_notes set is_published=true where id='33333333-3333-4333-8333-333333333333';
set local role anon;
do $$ begin
 if not exists(select id from public.private_notes where id='33333333-3333-4333-8333-333333333333' and published_at is not null and body='**Private**') then raise exception 'Published post not readable'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 update public.private_notes set body='hacked',is_published=false where id='33333333-3333-4333-8333-333333333333';
 if found then raise exception 'Another user edited public post'; end if;
 delete from public.private_notes where id='33333333-3333-4333-8333-333333333333';
 if found then raise exception 'Another user deleted public post'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
update public.private_notes set is_published=false where id='33333333-3333-4333-8333-333333333333';
do $$ begin
 if not exists(select id from public.private_notes where id='33333333-3333-4333-8333-333333333333' and published_at is null) then raise exception 'Unpublish failed'; end if;
end $$;
set local role anon;
do $$ begin
 if exists(select id from public.private_notes where id='33333333-3333-4333-8333-333333333333') then raise exception 'Unpublished post leaked'; end if;
end $$;
rollback;
select 'PASS: private default, publish, anonymous read-only access, owner privacy, other-user protection, unpublish; all fixtures rolled back' as result;
