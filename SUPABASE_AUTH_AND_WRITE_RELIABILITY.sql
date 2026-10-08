-- Server-only auth audit, revocation and canonical lesson counters.
alter table public.students add column if not exists session_version integer not null default 0;

create table if not exists public.login_events (
  id bigint generated always as identity primary key,
  account_id text,
  email text not null,
  role text not null check (role in ('student','instructor','super_admin','staff')),
  outcome text not null check (outcome in ('success','invalid_credentials','inactive','expired_invite','unavailable')),
  created_at timestamptz not null default now()
);
alter table public.login_events enable row level security;
revoke all on public.login_events from anon, authenticated;
grant select, insert on public.login_events to service_role;
grant usage on sequence public.login_events_id_seq to service_role;
create index if not exists login_events_account_time on public.login_events(account_id, created_at desc);

create or replace function public.revoke_changed_student_session()
returns trigger language plpgsql security invoker set search_path=public as $fn$
begin
  if new.account_status is distinct from old.account_status
     or new.email is distinct from old.email
     or new.archived_at is distinct from old.archived_at then
    new.session_version := old.session_version + 1;
  end if;
  return new;
end;
$fn$;
drop trigger if exists student_session_revocation on public.students;
create trigger student_session_revocation before update on public.students
for each row execute function public.revoke_changed_student_session();

create or replace function public.sync_invite_student_identity()
returns trigger language plpgsql security invoker set search_path=public as $fn$
begin
  if new.email is distinct from old.email or new.name is distinct from old.name then
    update public.invites
    set student = jsonb_set(jsonb_set(student,'{email}',to_jsonb(new.email),true),
                            '{name}',to_jsonb(new.name),true), updated_at=now()
    where student_id=new.id;
  end if;
  return new;
end;
$fn$;
drop trigger if exists student_invite_identity on public.students;
create trigger student_invite_identity after update on public.students
for each row execute function public.sync_invite_student_identity();

create or replace function public.sync_student_remaining(p_student_id text)
returns void language plpgsql security invoker set search_path=public as $fn$
declare v_remaining integer;
begin
  perform 1 from public.students where id=p_student_id for update;
  select greatest(0, (s.package->>'totalSessions')::integer - count(se.id)::integer)
  into v_remaining
  from public.students s left join public.sessions se
    on se.student_id=s.id and se.archived_at is null
    and se.session_date >= (s.package->>'startDate')::date
    and se.session_date <= (s.package->>'endDate')::date
    and se.status in ('attended','missed')
  where s.id=p_student_id
  group by s.id;
  if v_remaining is not null then
    update public.students set package=jsonb_set(package,'{remainingSessions}',to_jsonb(v_remaining),true),
      updated_at=now()
    where id=p_student_id;
  end if;
end;
$fn$;

create or replace function public.lock_session_student()
returns trigger language plpgsql security invoker set search_path=public as $fn$
begin
  if tg_op <> 'INSERT' then
    perform 1 from public.students where id=old.student_id for update;
  end if;
  if tg_op <> 'DELETE' then
    perform 1 from public.students where id=new.student_id for update;
    return new;
  end if;
  return old;
end;
$fn$;
drop trigger if exists lock_student_before_session on public.sessions;
create trigger lock_student_before_session before insert or update or delete on public.sessions
for each row execute function public.lock_session_student();

create or replace function public.sync_remaining_after_session()
returns trigger language plpgsql security invoker set search_path=public as $fn$
begin
  if tg_op <> 'INSERT' then perform public.sync_student_remaining(old.student_id); end if;
  if tg_op <> 'DELETE' then
    if tg_op='INSERT' or new.student_id is distinct from old.student_id then
      perform public.sync_student_remaining(new.student_id);
    end if;
    return new;
  end if;
  return old;
end;
$fn$;
drop trigger if exists sync_remaining_after_session on public.sessions;
create trigger sync_remaining_after_session after insert or update or delete on public.sessions
for each row execute function public.sync_remaining_after_session();

create or replace function public.sync_remaining_after_package()
returns trigger language plpgsql security invoker set search_path=public as $fn$
begin
  if new.package->>'totalSessions' is distinct from old.package->>'totalSessions'
     or new.package->>'startDate' is distinct from old.package->>'startDate'
     or new.package->>'endDate' is distinct from old.package->>'endDate'
     or new.package->>'remainingSessions' is distinct from old.package->>'remainingSessions' then
    perform public.sync_student_remaining(new.id);
  end if;
  return new;
end;
$fn$;
drop trigger if exists sync_remaining_after_package on public.students;
create trigger sync_remaining_after_package after update of package on public.students
for each row execute function public.sync_remaining_after_package();

-- Delete only rows with a missing parent. Archived/history sessions are valid parents.
delete from public.attendance_marks a
where not exists(select 1 from public.sessions se where se.id=a.session_id)
   or not exists(select 1 from public.students s where s.id=a.student_id);
delete from public.postpone_requests p
where not exists(select 1 from public.sessions se where se.id=p.session_id)
   or not exists(select 1 from public.students s where s.id=p.student_id);
delete from public.invites i where not exists(select 1 from public.students s where s.id=i.student_id);
delete from public.sessions se where not exists(select 1 from public.students s where s.id=se.student_id);

do $fn$
begin
  if not exists(select 1 from pg_constraint where conname='attendance_session_fk' and conrelid='public.attendance_marks'::regclass) then
    alter table public.attendance_marks add constraint attendance_session_fk foreign key(session_id) references public.sessions(id) on delete cascade;
  end if;
  if not exists(select 1 from pg_constraint where conname='attendance_student_fk' and conrelid='public.attendance_marks'::regclass) then
    alter table public.attendance_marks add constraint attendance_student_fk foreign key(student_id) references public.students(id) on delete cascade;
  end if;
end;
$fn$;

create or replace function public.sync_attendance_session()
returns trigger language plpgsql security invoker set search_path=public as $fn$
begin
  if not exists(select 1 from public.sessions s where s.id=new.session_id
    and s.student_id=new.student_id and s.session_date=new.session_date and s.group_id=new.group_id) then
    raise exception 'attendance does not match session';
  end if;
  update public.sessions set status=new.status, updated_at=now()
  where id=new.session_id and status is distinct from new.status
    and (new.status <> 'upcoming' or status in ('attend_pending','attended'));
  return new;
end;
$fn$;
drop trigger if exists attendance_session_sync on public.attendance_marks;
create trigger attendance_session_sync after insert or update on public.attendance_marks
for each row execute function public.sync_attendance_session();

create or replace function public.save_attendance_batch(p_marks jsonb, p_actor_id text, p_actor_role text)
returns void language plpgsql security invoker set search_path=public as $fn$
declare v_item jsonb; v_session public.sessions; v_instructor text;
begin
  if jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks)=0 then
    raise exception 'attendance batch required';
  end if;
  if p_actor_role not in ('student','instructor','super_admin') then raise exception 'invalid actor'; end if;
  perform 1 from public.students where id in
    (select se.student_id from public.sessions se join jsonb_array_elements(p_marks) m on se.id=m->>'session_id')
    order by id for update;
  for v_item in select value from jsonb_array_elements(p_marks) order by value->>'session_id' loop
    select * into v_session from public.sessions where id=v_item->>'session_id' for update;
    if not found or v_session.archived_at is not null then raise exception 'session not found'; end if;
    if v_item->>'status' not in ('attend_pending','attended','upcoming') then raise exception 'invalid attendance status'; end if;
    select instructor_id into v_instructor from public.students where id=v_session.student_id and archived_at is null;
    if not found then raise exception 'student not found'; end if;
    if p_actor_role='student' then
      if v_session.student_id<>p_actor_id or v_item->>'status'<>'attend_pending'
        or v_session.status<>'upcoming' or v_session.session_date<>(now() at time zone 'Europe/Istanbul')::date then
        raise exception 'attendance not allowed';
      end if;
    elsif p_actor_role='instructor' then
      if v_instructor<>p_actor_id and not (v_instructor in ('staff-delfin','staff-elif') and p_actor_id in ('staff-delfin','staff-elif')) then
        raise exception 'attendance not allowed';
      end if;
    end if;
    if v_item->>'status'='attended' and v_session.session_date>(now() at time zone 'Europe/Istanbul')::date then
      raise exception 'future attendance not allowed';
    end if;
    insert into public.attendance_marks(session_id,student_id,session_date,group_id,status,updated_at)
    values(v_session.id,v_session.student_id,v_session.session_date,v_session.group_id,v_item->>'status',now())
    on conflict(session_id) do update set student_id=excluded.student_id,session_date=excluded.session_date,
      group_id=excluded.group_id,status=excluded.status,updated_at=now();
  end loop;
end;
$fn$;
revoke all on function public.save_attendance_batch(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.save_attendance_batch(jsonb,text,text) to service_role;

create or replace function public.set_student_password(p_student_id text,p_password text,p_invite_token text default null,p_reset_token text default null)
returns void language plpgsql security invoker set search_path=public as $fn$
declare v_student public.students; v_invite public.invites;
begin
  select * into v_student from public.students where id=p_student_id and archived_at is null for update;
  if not found then raise exception 'student not found'; end if;
  select * into v_invite from public.invites where student_id=p_student_id for update;
  if not found then raise exception 'invite not found'; end if;
  if p_password not like 'scrypt$%' then raise exception 'hashed password required'; end if;
  if p_invite_token is not null then
    if v_invite.token<>p_invite_token or v_student.invite_token is distinct from p_invite_token
       or v_invite.activated_at is not null or v_student.account_status<>'invited'
       or v_student.invite_expires_at<=now() or v_student.invite_expires_at is null then
      raise exception 'invite invalid or expired';
    end if;
  end if;
  if p_reset_token is not null then
    update public.password_reset_tokens set used_at=now()
    where token=p_reset_token and account_id=p_student_id and kind='student'
      and lower(email)=lower(v_student.email) and used_at is null and expires_at>now();
    if not found then raise exception 'reset invalid or expired'; end if;
  end if;
  update public.invites set password=p_password,activated_at=coalesce(activated_at,now()),
    student=jsonb_set(jsonb_set(jsonb_set(student,'{accountStatus}','"active"'::jsonb,true),
      '{inviteToken}','null'::jsonb,true),'{inviteExpiresAt}','null'::jsonb,true),updated_at=now()
  where student_id=p_student_id;
  update public.students set account_status='active',invite_token=null,invite_expires_at=null,
    session_version=session_version+1,updated_at=now() where id=p_student_id;
end;
$fn$;
revoke all on function public.set_student_password(text,text,text,text) from public,anon,authenticated;
grant execute on function public.set_student_password(text,text,text,text) to service_role;

-- Bring existing metadata into agreement with the already displayed session calculation.
do $fn$
declare v_id text;
begin
  for v_id in select id from public.students order by id loop
    perform public.sync_student_remaining(v_id);
  end loop;
end;
$fn$;

create or replace function public.set_session_outcome(p_session_id text,p_status text,p_actor_id text,p_actor_role text,p_reason text default '')
returns void language plpgsql security invoker set search_path=public as $fn$
declare v_session public.sessions; v_student public.students; v_request public.postpone_requests; v_other record;
begin
  select st.* into v_student from public.students st join public.sessions se on st.id=se.student_id
    where se.id=p_session_id and st.archived_at is null for update of st;
  if not found then raise exception 'student not found'; end if;
  select * into v_session from public.sessions where id=p_session_id and archived_at is null for update;
  if not found or v_session.session_date<(v_student.package->>'startDate')::date
    or v_session.session_date>(v_student.package->>'endDate')::date then raise exception 'session not active'; end if;
  if p_status not in ('attended','missed','postponed','upcoming') then raise exception 'invalid status'; end if;
  if p_actor_role<>'super_admin' and not (p_actor_role='instructor' and
     (v_student.instructor_id=p_actor_id or (v_student.instructor_id in ('staff-delfin','staff-elif') and p_actor_id in ('staff-delfin','staff-elif')))) then
    raise exception 'outcome not allowed';
  end if;
  if p_status in ('attended','missed') and v_session.session_date>(now() at time zone 'Europe/Istanbul')::date then
    raise exception 'future outcome not allowed';
  end if;
  select * into v_request from public.postpone_requests
    where session_id=p_session_id and status<>'rejected' order by created_at desc limit 1 for update;
  if p_status='postponed' then
    if v_request.id is not null then
      update public.postpone_requests set status='approved',updated_at=now() where id=v_request.id;
    else
      for v_other in select p.id,p.session_id from public.postpone_requests p join public.sessions se on se.id=p.session_id
        where p.student_id=v_student.id and p.status<>'rejected' and se.archived_at is null
        and se.session_date between (v_student.package->>'startDate')::date and (v_student.package->>'endDate')::date loop
        update public.postpone_requests set status='rejected',updated_at=now() where id=v_other.id;
        update public.sessions set status='upcoming' where id=v_other.session_id;
      end loop;
      insert into public.postpone_requests(id,student_id,session_id,reason,status,created_at,updated_at)
        values('req-'||p_session_id||'-'||gen_random_uuid()::text,v_student.id,p_session_id,
          coalesce(nullif(trim(p_reason),''),'Eğitmen erteleme işaretledi.'),'approved',now(),now());
    end if;
  else
    update public.postpone_requests set status='rejected',updated_at=now()
      where session_id=p_session_id and status<>'rejected';
  end if;
  update public.sessions set status=p_status,updated_at=now() where id=p_session_id;
  update public.attendance_marks set status=case when p_status='attended' then 'attended' else 'upcoming' end,
    updated_at=now() where session_id=p_session_id;
end;
$fn$;
revoke all on function public.set_session_outcome(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.set_session_outcome(text,text,text,text,text) to service_role;

create or replace function public.reset_staff_password(p_token text,p_password_hash text)
returns void language plpgsql security invoker set search_path=public as $fn$
declare v_token public.password_reset_tokens;
begin
  select * into v_token from public.password_reset_tokens
    where token=p_token and kind='staff' and used_at is null and expires_at>now() for update;
  if not found or p_password_hash not like 'scrypt$%' then raise exception 'reset invalid or expired'; end if;
  update public.staff_credentials set password_hash=p_password_hash,updated_at=now() where staff_id=v_token.account_id;
  if not found then raise exception 'staff not found'; end if;
  update public.password_reset_tokens set used_at=now() where token=p_token;
end;
$fn$;
revoke all on function public.reset_staff_password(text,text) from public,anon,authenticated;
grant execute on function public.reset_staff_password(text,text) to service_role;

revoke all on function public.sync_student_remaining(text) from public,anon,authenticated;
grant execute on function public.sync_student_remaining(text) to service_role;
create unique index if not exists students_normalized_email_unique
on public.students (lower(btrim(email))) where email is not null and btrim(email)<>'';
create unique index if not exists invites_student_unique on public.invites(student_id);

create or replace function public.save_student_invite(p_token text,p_student_id text,p_student jsonb,p_sessions jsonb,p_expires_at timestamptz)
returns void language plpgsql security invoker set search_path=public as $fn$
declare v_student public.students;
begin
  select * into v_student from public.students where id=p_student_id and archived_at is null for update;
  if not found then raise exception 'student not found'; end if;
  if v_student.account_status<>'active' and v_student.invite_token is distinct from p_token then
    raise exception 'invite changed';
  end if;
  insert into public.invites(token,student_id,student,sessions,expires_at,created_at,updated_at)
  values(p_token,p_student_id,p_student || jsonb_build_object(
    'id',v_student.id,'name',v_student.name,'email',v_student.email,'accountStatus',v_student.account_status,
    'inviteToken',v_student.invite_token,'inviteExpiresAt',v_student.invite_expires_at),
    p_sessions,p_expires_at,now(),now())
  on conflict(student_id) do update set token=excluded.token,student=excluded.student,
    sessions=excluded.sessions,expires_at=excluded.expires_at,updated_at=now();
end;
$fn$;
revoke all on function public.save_student_invite(text,text,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.save_student_invite(text,text,jsonb,jsonb,timestamptz) to service_role;
create or replace function public.delete_student_bundle(p_student_id text)
returns void language plpgsql security invoker set search_path=public as $fn$
begin
  perform 1 from public.students where id=p_student_id and archived_at is not null for update;
  if not found then raise exception 'archive student before deletion'; end if;
  delete from public.password_reset_tokens where kind='student' and account_id=p_student_id;
  delete from public.invites where student_id=p_student_id;
  delete from public.attendance_marks where student_id=p_student_id;
  delete from public.postpone_requests where student_id=p_student_id;
  delete from public.students where id=p_student_id;
end;
$fn$;
revoke all on function public.delete_student_bundle(text) from public,anon,authenticated;
grant execute on function public.delete_student_bundle(text) to service_role;
alter table public.login_events add column if not exists source text not null default 'web' check(source in ('web','test'));
alter table public.invites add constraint invites_student_fk foreign key(student_id) references public.students(id) on delete cascade;
alter table public.postpone_requests add constraint postpone_student_fk foreign key(student_id) references public.students(id) on delete cascade;
