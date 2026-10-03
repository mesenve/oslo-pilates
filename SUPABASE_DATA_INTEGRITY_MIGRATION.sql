-- Applied to project hiopdvoxhslgqpvoaaza on 2026-10-03.
-- Keep server-only write RPCs inaccessible to browser roles. Netlify calls
-- them with service_role, so this does not change the application flow.
alter table public.password_reset_tokens enable row level security;

revoke execute on function public.apply_student_postpone(text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.patch_student_package(text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.review_student_postpone(text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.save_student_bundle(jsonb, jsonb, jsonb, boolean)
  from public, anon, authenticated;
revoke execute on function public.save_student_bundle(jsonb, jsonb, jsonb, boolean, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.withdraw_student_postpone(text, text, text)
  from public, anon, authenticated;

grant execute on function public.apply_student_postpone(text, text, text, text, timestamptz)
  to service_role;
grant execute on function public.patch_student_package(text, jsonb)
  to service_role;
grant execute on function public.review_student_postpone(text, text, text, text)
  to service_role;
grant execute on function public.save_student_bundle(jsonb, jsonb, jsonb, boolean)
  to service_role;
grant execute on function public.save_student_bundle(jsonb, jsonb, jsonb, boolean, timestamptz)
  to service_role;
grant execute on function public.withdraw_student_postpone(text, text, text)
  to service_role;
