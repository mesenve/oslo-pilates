-- Re-apply save_student_bundle so schedule edits no longer hard-delete
-- postpone_requests for retired session IDs. Source of truth matches
-- SUPABASE_SESSION_ARCHIVE_MIGRATION.sql after the postpone-history fix.
-- Run in the Supabase SQL editor once.

create or replace function public.save_student_bundle(
  p_student jsonb,
  p_sessions jsonb,
  p_custom_group jsonb default null,
  p_clear_postpones boolean default false,
  p_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_student_id text := p_student->>'id';
  v_current_updated_at timestamptz;
begin
  if v_student_id is null or v_student_id = '' then
    raise exception 'student id required';
  end if;

  if p_expected_updated_at is not null then
    select updated_at into v_current_updated_at
    from public.students
    where id = v_student_id
    for update;
    if v_current_updated_at is null or v_current_updated_at is distinct from p_expected_updated_at then
      raise exception 'student changed';
    end if;
  end if;

  if p_custom_group is not null and jsonb_typeof(p_custom_group) = 'object' then
    insert into public.custom_groups (id, days, time, capacity, label, updated_at)
    values (
      p_custom_group->>'id',
      coalesce(p_custom_group->'days', '[]'::jsonb),
      p_custom_group->>'time',
      coalesce((p_custom_group->>'capacity')::integer, 2),
      p_custom_group->>'label',
      now()
    )
    on conflict (id) do update set
      days = excluded.days,
      time = excluded.time,
      capacity = excluded.capacity,
      label = excluded.label,
      updated_at = now();
  end if;

  insert into public.students (
    id, name, email, phone, group_id, instructor_id, package_type, note,
    measurements, package, monthly_postpone_limit, account_status,
    invite_token, invite_expires_at, invited_at, archived_at, updated_at
  ) values (
    v_student_id,
    p_student->>'name',
    lower(p_student->>'email'),
    coalesce(p_student->>'phone', ''),
    p_student->>'group_id',
    p_student->>'instructor_id',
    p_student->>'package_type',
    coalesce(p_student->>'note', ''),
    coalesce(p_student->'measurements', '{}'::jsonb),
    coalesce(p_student->'package', '{}'::jsonb),
    coalesce((p_student->>'monthly_postpone_limit')::integer, 1),
    coalesce(p_student->>'account_status', 'invited'),
    nullif(p_student->>'invite_token', ''),
    nullif(p_student->>'invite_expires_at', '')::timestamptz,
    nullif(p_student->>'invited_at', '')::timestamptz,
    nullif(p_student->>'archived_at', '')::timestamptz,
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    group_id = excluded.group_id,
    instructor_id = excluded.instructor_id,
    package_type = excluded.package_type,
    note = excluded.note,
    measurements = excluded.measurements,
    package = excluded.package,
    monthly_postpone_limit = excluded.monthly_postpone_limit,
    account_status = excluded.account_status,
    invite_token = excluded.invite_token,
    invite_expires_at = excluded.invite_expires_at,
    invited_at = excluded.invited_at,
    archived_at = excluded.archived_at,
    updated_at = now();

  if p_clear_postpones then
    delete from public.postpone_requests
    where student_id = v_student_id;
  end if;

  update public.sessions
  set archived_at = now(), updated_at = now()
  where student_id = v_student_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb)) as item
      where item->>'id' = sessions.id
    );

  insert into public.sessions (
    id, student_id, group_id, session_date, status, archived_at, updated_at
  )
  select
    value->>'id',
    value->>'student_id',
    value->>'group_id',
    (value->>'session_date')::date,
    coalesce(value->>'status', 'upcoming'),
    null,
    now()
  from jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb))
  on conflict (id) do update set
    student_id = excluded.student_id,
    group_id = excluded.group_id,
    session_date = excluded.session_date,
    status = excluded.status,
    archived_at = null,
    updated_at = now();
end;
$function$;

revoke execute on function public.save_student_bundle(jsonb, jsonb, jsonb, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_student_bundle(jsonb, jsonb, jsonb, boolean, timestamptz)
  to service_role;
