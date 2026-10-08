begin;
do $checks$
declare
  v_id text := '__oslo_reliability_test__';
  v_day date := (now() at time zone 'Europe/Istanbul')::date;
  v_student jsonb;
  v_sessions jsonb;
  v_package jsonb;
  v_expected timestamptz;
  v_failed boolean;
  v_version integer;
begin
  if exists(select 1 from public.students where id=v_id) then raise exception 'test id already exists'; end if;
  v_package := jsonb_build_object('totalSessions',4,'remainingSessions',4,
    'startDate',(v_day-2)::text,'endDate',(v_day+4)::text,'paymentStatus','pending');
  v_student := jsonb_build_object('id',v_id,'name','Isolated test student','email','oslo-reliability@example.invalid',
    'group_id','test-group','instructor_id','staff-ece','package_type','group_5',
    'package',v_package,'account_status','invited','invite_token','__test_invite__',
    'invite_expires_at',(now()+interval '2 days')::text);
  select jsonb_agg(jsonb_build_object('id',v_id||'-'||d::text,'student_id',v_id,'group_id','test-group',
    'session_date',d::text,'status','upcoming')) into v_sessions
    from unnest(array[v_day-2,v_day,v_day+2,v_day+4]) d;
  perform public.save_student_bundle(v_student,v_sessions,null,false,null);
  assert (select count(*)=4 from public.sessions where student_id=v_id and archived_at is null),'create bundle';
  assert (select (package->>'remainingSessions')::int=4 from public.students where id=v_id),'initial counter';

  perform public.save_student_invite('__test_invite__',v_id,
    jsonb_build_object('id',v_id,'email','stale@example.invalid'),v_sessions,now()+interval '2 days');
  assert (select student->>'email'='oslo-reliability@example.invalid' from public.invites where student_id=v_id),'canonical invite email';

  perform public.set_student_password(v_id,'scrypt$test$test','__test_invite__',null);
  assert (select account_status='active' and invite_token is null from public.students where id=v_id),'activation atomic';
  assert (select password='scrypt$test$test' and activated_at is not null from public.invites where student_id=v_id),'activation password';
  v_failed:=false;
  begin perform public.set_student_password(v_id,'scrypt$test$new','__test_invite__',null);
  exception when others then v_failed:=true; end;
  assert v_failed,'activation single use';

  perform public.save_attendance_batch(jsonb_build_array(jsonb_build_object('session_id',v_id||'-'||v_day::text,
    'status','attend_pending')),v_id,'student');
  assert (select status='attend_pending' from public.sessions where id=v_id||'-'||v_day::text),'student attendance pending';
  perform public.save_attendance_batch(jsonb_build_array(jsonb_build_object('session_id',v_id||'-'||v_day::text,
    'status','attended')),'staff-ece','super_admin');
  assert (select status='attended' from public.sessions where id=v_id||'-'||v_day::text),'attendance canonical';
  assert (select (package->>'remainingSessions')::int=3 from public.students where id=v_id),'attendance counter';

  v_failed:=false;
  begin
    perform public.save_attendance_batch(jsonb_build_array(
      jsonb_build_object('session_id',v_id||'-'||(v_day-2)::text,'status','attended'),
      jsonb_build_object('session_id','missing-session','status','attended')),'staff-ece','super_admin');
  exception when others then v_failed:=true; end;
  assert v_failed,'invalid batch rejected';
  assert (select status='upcoming' from public.sessions where id=v_id||'-'||(v_day-2)::text),'batch rollback';
  assert not exists(select 1 from public.attendance_marks where session_id=v_id||'-'||(v_day-2)::text),'batch marks rollback';

  perform public.set_session_outcome(v_id||'-'||(v_day-2)::text,'missed','staff-ece','super_admin','');
  assert (select (package->>'remainingSessions')::int=2 from public.students where id=v_id),'manual missed counter';
  perform public.set_session_outcome(v_id||'-'||v_day::text,'upcoming','staff-ece','super_admin','');
  assert (select (package->>'remainingSessions')::int=3 from public.students where id=v_id),'attendance undo counter';
  assert (select status='upcoming' from public.attendance_marks where session_id=v_id||'-'||v_day::text),'attendance undo mark';

  v_failed:=false;
  begin perform public.set_session_outcome(v_id||'-'||(v_day+2)::text,'attended','staff-ece','super_admin','');
  exception when others then v_failed:=true; end;
  assert v_failed,'future attendance rejected';
  v_failed:=false;
  begin perform public.set_session_outcome(v_id||'-'||v_day::text,'attended','staff-elif','instructor','');
  exception when others then v_failed:=true; end;
  assert v_failed,'instructor ownership checked';

  insert into public.password_reset_tokens(token,kind,account_id,email,expires_at)
    values('__test_reset__','student',v_id,'oslo-reliability@example.invalid',now()+interval '1 hour');
  perform public.set_student_password(v_id,'scrypt$test$reset',null,'__test_reset__');
  assert (select used_at is not null from public.password_reset_tokens where token='__test_reset__'),'reset consumed atomically';
  v_failed:=false;
  begin perform public.set_student_password(v_id,'scrypt$test$reused',null,'__test_reset__');
  exception when others then v_failed:=true; end;
  assert v_failed,'reset single use';

  select session_version into v_version from public.students where id=v_id;
  update public.students set email='oslo-reliability-renamed@example.invalid' where id=v_id;
  assert (select session_version>v_version from public.students where id=v_id),'email revokes session';
  assert (select student->>'email'='oslo-reliability-renamed@example.invalid' and password='scrypt$test$reset'
    from public.invites where student_id=v_id),'email sync keeps password';

  select updated_at,to_jsonb(s) into v_expected,v_student from public.students s where id=v_id;
  perform public.save_student_bundle(v_student||jsonb_build_object('name','Updated name'),v_sessions,null,false,v_expected);
  -- Use an unquestionably stale token; now() is stable throughout this test transaction.
  v_failed:=false;
  begin perform public.save_student_bundle(v_student,v_sessions,null,false,v_expected-interval '1 second');
  exception when others then v_failed:=true; end;
  assert v_failed,'stale update rejected';
  assert (select name='Updated name' from public.students where id=v_id),'stale write cannot revert name';

  perform public.set_session_outcome(v_id||'-'||(v_day+2)::text,'postponed','staff-ece','super_admin','test note');
  assert exists(select 1 from public.postpone_requests where student_id=v_id and status='approved'),'manual postpone recorded';
  perform public.set_session_outcome(v_id||'-'||(v_day+2)::text,'upcoming','staff-ece','super_admin','');
  assert not exists(select 1 from public.postpone_requests where student_id=v_id and status='approved'),'postpone undo';

  v_failed:=false;
  begin insert into public.attendance_marks(session_id,student_id,session_date,group_id,status)
    values('__missing__',v_id,v_day,'test-group','attended');
  exception when foreign_key_violation then v_failed:=true; end;
  assert v_failed,'orphan attendance forbidden';

  delete from public.sessions where student_id=v_id;
  assert not exists(select 1 from public.attendance_marks where student_id=v_id),'delete cascade marks';
end;
$checks$;
rollback;
