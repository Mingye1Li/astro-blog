begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('11111111-1111-4111-8111-111111111111','approval-admin@example.invalid',now(),'{}'),
('22222222-2222-4222-8222-222222222222','approval-member@example.invalid',now(),'{"role":"admin","status":"approved"}');
do $$ begin
 if not exists(select 1 from app_private.account_access where user_id='22222222-2222-4222-8222-222222222222' and role='member' and status='pending') then raise exception 'Signup must default to pending member'; end if;
end $$;
update app_private.account_access set role='admin',status='approved' where user_id='11111111-1111-4111-8111-111111111111';
insert into public.private_notes(id,user_id,title) values ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Pending own note');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","user_metadata":{"role":"admin","status":"approved"}}',true);
do $$ begin
 if app_private.has_access() or app_private.is_admin() then raise exception 'Pending metadata forgery bypassed approval'; end if;
 if not exists(select 1 from public.get_my_access() where role='member' and status='pending') then raise exception 'Cannot read own pending state'; end if;
 if exists(select 1 from public.private_notes) then raise exception 'Pending user can read'; end if;
 begin insert into public.private_notes(title) values ('Denied'); raise exception 'Pending insert allowed'; exception when insufficient_privilege then null; end;
 update public.private_notes set title='Denied'; if found then raise exception 'Pending update allowed'; end if;
 delete from public.private_notes; if found then raise exception 'Pending delete allowed'; end if;
 begin perform * from public.list_accounts(); raise exception 'Pending user can list accounts'; exception when insufficient_privilege then null; end;
 begin perform public.review_account('22222222-2222-4222-8222-222222222222','approved'); raise exception 'Self approval allowed'; exception when insufficient_privilege then null; end;
 begin update app_private.account_access set role='admin'; raise exception 'Direct privilege escalation allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.list_accounts()) < 2 then raise exception 'Admin cannot list accounts'; end if;
 if exists(select 1 from public.private_notes where user_id='22222222-2222-4222-8222-222222222222') then raise exception 'Admin reads others private notes'; end if;
 begin perform public.review_account('11111111-1111-4111-8111-111111111111','rejected'); raise exception 'Admin self-lockout allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.review_account('22222222-2222-4222-8222-222222222222','invalid'); raise exception 'Invalid status allowed'; exception when invalid_parameter_value then null; end;
 perform public.review_account('22222222-2222-4222-8222-222222222222','approved');
end $$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 if not app_private.has_access() or app_private.is_admin() then raise exception 'Approved member permissions incorrect'; end if;
 if not exists(select 1 from public.private_notes where id='33333333-3333-4333-8333-333333333333') then raise exception 'Approved member cannot read own note'; end if;
 insert into public.private_notes(title) values ('Approved insert');
 update public.private_notes set body='Approved update' where id='33333333-3333-4333-8333-333333333333';
 if not found then raise exception 'Approved update failed'; end if;
 begin perform * from public.list_accounts(); raise exception 'Member can list accounts'; exception when insufficient_privilege then null; end;
 begin perform public.review_account('22222222-2222-4222-8222-222222222222','approved'); raise exception 'Member can review'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select public.review_account('22222222-2222-4222-8222-222222222222','rejected');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 if app_private.has_access() or exists(select 1 from public.private_notes) then raise exception 'Revocation did not take effect immediately'; end if;
 begin insert into public.private_notes(title) values ('Denied'); raise exception 'Rejected insert allowed'; exception when insufficient_privilege then null; end;
 update public.private_notes set title='Denied'; if found then raise exception 'Rejected update allowed'; end if;
 delete from public.private_notes; if found then raise exception 'Rejected delete allowed'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.get_my_access(); raise exception 'Anonymous access allowed'; exception when insufficient_privilege then null; end;
 begin perform * from public.list_accounts(); raise exception 'Anonymous listing allowed'; exception when insufficient_privilege then null; end;
 begin perform public.review_account('22222222-2222-4222-8222-222222222222','approved'); raise exception 'Anonymous review allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: pending defaults, metadata forgery blocked, admin-only review, no self escalation, owner privacy, approval, immediate revocation, anonymous denial; fixtures rolled back' as result;
