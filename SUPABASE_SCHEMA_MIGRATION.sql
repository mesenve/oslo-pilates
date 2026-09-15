-- Applied to project hiopdvoxhslgqpvoaaza on 2026-09-15.
-- Keep this file as the reproducible schema/RLS migration record.
create table if not exists public.custom_groups (
  id text primary key,
  days jsonb not null default '[]'::jsonb,
  time text not null,
  capacity integer not null default 2,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sessions_student_date_idx on public.sessions(student_id, session_date);
create index if not exists postpone_requests_session_idx on public.postpone_requests(session_id);
create unique index if not exists students_email_lower_unique on public.students(lower(email));
alter table public.custom_groups enable row level security;
drop policy if exists "custom_groups_no_client_write" on public.custom_groups;
create policy "custom_groups_no_client_write" on public.custom_groups for all to anon, authenticated using (false) with check (false);
drop policy if exists "students_select_own" on public.students;
create policy "students_select_own" on public.students for select to authenticated using ((select auth.uid())::text = id);
drop policy if exists "students_update_own" on public.students;
create policy "students_update_own" on public.students for update to authenticated using ((select auth.uid())::text = id) with check ((select auth.uid())::text = id);
drop policy if exists "sessions_select_own" on public.sessions;
create policy "sessions_select_own" on public.sessions for select to authenticated using ((select auth.uid())::text = student_id);
drop policy if exists "attendance_select_own" on public.attendance_marks;
create policy "attendance_select_own" on public.attendance_marks for select to authenticated using ((select auth.uid())::text = student_id);
drop policy if exists "attendance_insert_own" on public.attendance_marks;
create policy "attendance_insert_own" on public.attendance_marks for insert to authenticated with check ((select auth.uid())::text = student_id);
drop policy if exists "postpone_select_own" on public.postpone_requests;
create policy "postpone_select_own" on public.postpone_requests for select to authenticated using ((select auth.uid())::text = student_id);
drop policy if exists "postpone_insert_own" on public.postpone_requests;
create policy "postpone_insert_own" on public.postpone_requests for insert to authenticated with check ((select auth.uid())::text = student_id);
drop policy if exists "blocked_emails_no_client_access" on public.blocked_emails;
create policy "blocked_emails_no_client_access" on public.blocked_emails for all to anon, authenticated using (false) with check (false);
drop policy if exists "invites_no_client_access" on public.invites;
create policy "invites_no_client_access" on public.invites for all to anon, authenticated using (false) with check (false);
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
