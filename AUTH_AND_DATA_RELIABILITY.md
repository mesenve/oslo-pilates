# Authentication and student data reliability

Verified on 8 October 2026.

## Changes

- Correct Next.js session cookie settings, including HttpOnly, Secure, SameSite, expiry, browser-session mode and logout deletion.
- Validate student account status and stored credentials on protected requests; revoke outdated sessions on password, email, account status or archive changes.
- Authenticate against the current student email and synchronize invite identity without replacing existing passwords.
- Actionable messages for incomplete/expired invitations and service outages.
- Transactional activation, password resets, attendance, lesson outcomes and permanent student deletion.
- Database triggers keep remaining lessons aligned with active package sessions.
- Preserve the form's original edit token and reject stale saves.
- Successful writes update the client's canonical student row and edit timestamp.
- Paginate studio reads to prevent truncated programmes.
- Record new login outcomes; test runs can be labelled separately.
- Remove demo login shortcuts and staff-password fallback from authentication.
- Clean source lint checks and exclude generated Netlify output.

## Database deployment

The server-only SQL routines, counters, audit table and orphan cleanup have already been applied to the associated Supabase project. Browser roles have no access to the new privileged write routines.

Eleven attendance rows with missing parents were removed. Final checks found no orphan attendance, invite or postpone rows. Valid archived lessons were retained. All 92 student records remained present; temporary test records were removed.

Existing teacher credential values were preserved while being stored as hashes. No credential values or personal student records are included in this report.

## Verification

| Check | Result |
|---|---|
| 26 actual-source authentication/session/client tests | PASS |
| 23 production Next.js + Supabase HTTP workflows | PASS |
| 27 isolated SQL assertions, followed by rollback | PASS |
| Existing targeted-write, session-guard and postponement smoke checks | PASS |
| ESLint and TypeScript/production build | PASS |

The HTTP checks covered login, mock-student creation, activation, attendance, postponement and withdrawal, repeated edits, stale-save rejection, group/private programme transitions, package renewal, email changes, password reset, archive and deletion. Existing real-account checks were read-only.

## Running the tests

```powershell
node scripts/test-auth-reliability.mjs
node scripts/check-targeted-writes.mjs
node scripts/check-session-guard.mjs
node scripts/check-postpone-package.mjs
npm.cmd run lint
npm.cmd run build
```

The integration test reads server settings through the authenticated Netlify CLI. Supply `OSLO_TEST_STUDENT_EMAIL`, `OSLO_TEST_STUDENT_PASSWORD`, `OSLO_TEST_INVITED_EMAIL` and `OSLO_TEST_STAFF_PASSWORD` privately through environment variables before running `node scripts/test-live-reliability.mjs`. Do not commit credentials. The test creates and cleans up an isolated student and does not send email.

## Release note

This branch contains the tested application changes. Existing legacy sessions must sign in once after the application release. Incomplete invitation accounts still require activation.

The Netlify production branch is `main`, with automatic builds enabled. This work is published on a separate GitHub branch; it does not update `main` or request a production deployment.
