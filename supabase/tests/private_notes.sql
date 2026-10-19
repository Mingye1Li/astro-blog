begin;
insert into auth.users (id, email, email_confirmed_at) values ('11111111-1111-4111-8111-111111111111','notes-rls-a@example.invalid',now()),('22222222-2222-4222-8222-222222222222','notes-rls-b@example.invalid',now());
update app_private.account_access set status='approved' where user_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
insert into public.private_notes (id,title,body) values ('33333333-3333-4333-8333-333333333333','RLS test','private');
do $$ begin
 if (select count(*) from public.private_notes) <> 1 then raise exception 'Owner select failed'; end if;
 update public.private_notes set body='updated' where id='33333333-3333-4333-8333-333333333333';
 if not found then raise exception 'Owner update failed'; end if;
 begin
  insert into public.private_notes(user_id,title) values ('22222222-2222-4222-8222-222222222222','forged');
  raise exception 'Forged insert allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.private_notes set user_id='22222222-2222-4222-8222-222222222222';
  raise exception 'Ownership reassignment allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.private_notes) then raise exception 'Other user can read notes'; end if;
 update public.private_notes set body='hacked' where id='33333333-3333-4333-8333-333333333333';
 if found then raise exception 'Other user can update'; end if;
 delete from public.private_notes where id='33333333-3333-4333-8333-333333333333';
 if found then raise exception 'Other user can delete'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 delete from public.private_notes where id='33333333-3333-4333-8333-333333333333';
 if not found then raise exception 'Owner delete failed'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.private_notes; raise exception 'Anonymous select allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.private_notes(title) values ('anonymous'); raise exception 'Anonymous insert allowed'; exception when insufficient_privilege then null; end;
 begin update public.private_notes set body='anonymous'; raise exception 'Anonymous update allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.private_notes; raise exception 'Anonymous delete allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: owner CRUD, other-user isolation, ownership protection, anonymous denial; fixtures rolled back' as result;
