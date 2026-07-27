# Teacher Lesson Tracker

This directory provides a private teacher dashboard for the framework-free CD Digital Chess site. GitHub Pages or another static host serves the HTML, CSS, and JavaScript. Supabase supplies authentication, PostgreSQL storage, account approval, audit history, and Row Level Security.

## Current workflow

- Teachers create an email/password account and confirm the email address.
- New teacher accounts remain pending until a platform administrator approves them.
- Approved teachers add private student records directly.
- Students do not create management accounts, supply email addresses, join with class codes, or open the management dashboard.
- Teachers track curriculum lessons as Not yet taught, Taught, Needs practice, or Completed.
- Teachers record dated coaching sessions, duration, homework, and next steps.
- The selected-student Coach Session Command Center brings the latest session, next step, recommended curriculum lesson, latest puzzle-assignment result, a reload-safe timer, lesson access, Live Board access, and the existing session form into one workflow.
- Approved teachers publish one coach-controlled workspace per student. The same permanent private link reflects the current instructions, homework, due date, assigned lesson, FEN position, secure Live Board student link, published puzzle work, progress, and scores.
- Approved teachers generate, publish, monitor, edit, duplicate, archive, restore, and permanently delete Lichess puzzle assignments for their students.
- Teachers can export account data and ordinary teacher accounts can permanently delete themselves after password confirmation.
- Platform administrators can approve or suspend teachers, grant or remove administrator access, and inspect limited management audit metadata.

## Main pages

- `index.html` — management landing page
- `login.html` — teacher registration, sign-in, and password-recovery request
- `reset-password.html` — password update after a recovery email
- `pending.html` — pending or suspended teacher status
- `teacher.html` — private student, session, curriculum, and published puzzle-assignment dashboard
- `student-workspace.html` — permanent token-scoped view of only the work selected by the coach
- `assignment.html` — token-scoped student puzzle runner; students do not sign in to the management dashboard
- `account.html` — password change, full data export, and account deletion
- `admin.html` — teacher-account approval, administrator ownership, and audit history
- `privacy.html` — operational privacy notice requiring legal review before public launch

The retired anonymous student join page, student dashboard, and their JavaScript files are intentionally removed.

## Coach Session Command Center

The command center is shown for the selected student in `teacher.html`. It does not create a parallel session record or require another database table.

- **Start coaching session** chooses a useful lesson from curriculum state, preferring Needs practice, the latest unfinished lesson, previously taught work, and then the next available lesson.
- The running timer is kept in `sessionStorage` under `coach-session-command-v1`, survives a dashboard reload for up to 12 hours, and remains associated with one student.
- **Open recommended lesson** and **Open Live Board** keep the teaching tools one click from the student's current context.
- **End and log session** transfers elapsed minutes and the recommended lesson into the existing coaching-session form, where the teacher completes notes, homework, and the next step before saving.
- The latest puzzle-assignment status, completion count, and score are summarized through an in-page event from the assignment dashboard. Private link tokens are not included.
- Archived students can be reviewed but cannot start another timed session.

No timer state is stored in Supabase. The durable coaching record remains the existing `coaching_sessions` row created only when the teacher saves the form.

## Coach-controlled student workspace

The workspace is a coach-owned publication surface, not an independent learner dashboard:

- One `student_workspaces` row and permanent bearer link belong to each teacher-managed student.
- The coach chooses the instructions, homework and due date, curriculum lesson, optional FEN position, and secure Live Board **student** link.
- All currently published puzzle assignments for that student appear automatically with completion and score. The workspace token can open and save only assignments belonging to the same active student and teacher.
- Students do not register, browse the coach dashboard, change assignments, or select their own curriculum.
- The coach can pause the workspace while preserving its setup, or replace the permanent link to revoke the old token immediately.
- Plaintext workspace tokens stay in the coach browser; Supabase stores only SHA-256 hashes. A missing local token must be replaced, not recovered from the database.

## Database migrations

Run the migrations in order:

```text
supabase/migrations/001_management_v1.sql
supabase/migrations/002_management_v1_hardening.sql
supabase/migrations/003_management_v1_rpc_shapes.sql
supabase/migrations/004_teacher_managed_students.sql
supabase/migrations/005_coaching_sessions.sql
supabase/migrations/006_teacher_account_controls.sql
supabase/migrations/007_management_audit_log.sql
supabase/migrations/008_management_approval_policies.sql
supabase/migrations/009_platform_admin_management.sql
supabase/migrations/010_teacher_puzzle_assignments.sql
supabase/migrations/20260722151113_add_live_board_rooms.sql
supabase/migrations/20260722152107_fix_live_board_pgcrypto_search_path.sql
supabase/migrations/20260727054209_coach_controlled_student_workspace.sql
```

Migrations 006 through 009 add the V2.1 hardening foundation:

- pending, approved, and suspended teacher-account states
- a transferable platform-administrator role with final-admin protection
- administrator RPCs for account and administrator review
- audit history for teacher reviews, administrator changes, students, lesson progress, sessions, exports, and deletion
- approval-aware Row Level Security on the current management tables
- self-service account deletion for non-administrator teachers

The migrations automatically approve existing teacher accounts and assign the earliest existing teacher as the first platform administrator. New teachers start as pending.

Migration 010 adds teacher-owned puzzle assignments, frozen position snapshots, per-student assignment records, attempts/results, token-scoped student RPCs, and cascading cleanup policies.

Migration `20260727054209` adds teacher-owned student workspaces, RLS policies, revocable permanent-link hashes, token-scoped read access, and workspace-authorized puzzle loading/saving. Apply it before loading the new editor; the static frontend does not modify production schema itself.

## Teacher puzzle assignments

The assignment builder selects validated positions from the app's installed Lichess Position Training library, currently 30,000 puzzles across 1,200 shards. Generation happens before publication so the teacher can inspect or replace the frozen puzzle set.

Publishing creates a separate private link for every assigned student. The browser generates random bearer tokens, while Supabase stores only SHA-256 token hashes. Students open `assignment.html` directly and do not receive teacher-dashboard credentials.

Teacher controls include:

- edit title, instructions, due date, passing score, hint policy, and retry policy;
- preserve the frozen puzzle set after students begin;
- duplicate an assignment for the same active students with new private links;
- archive to disable access without deleting results;
- restore an archived assignment;
- permanently delete after typed `DELETE` confirmation.

Permanent deletion cascades through frozen positions, student links, attempts, progress, and results. The dashboard also removes locally stored plaintext teacher link tokens after deletion. Never put a service-role key in the browser to bypass these policies.

## Supabase Auth configuration

In the hosted Supabase dashboard:

1. Enable email/password authentication.
2. Require email confirmation for new teachers.
3. Set the Site URL to the deployed site, such as `https://cddigital.top`.
4. Add these Redirect URLs:

```text
https://cddigital.top/management/pending.html
https://cddigital.top/management/reset-password.html
http://127.0.0.1:8000/management/pending.html
http://127.0.0.1:8000/management/reset-password.html
http://localhost:8000/management/pending.html
http://localhost:8000/management/reset-password.html
```

5. Configure custom SMTP before relying on confirmation and recovery emails in production.
6. Enable password-change security notifications when available.

Anonymous Sign-Ins are not required by the current management dashboard.

## Static frontend configuration

Set the public Supabase project URL and browser-safe publishable key in:

```text
management/js/config.mjs
```

Never put a service-role key, database password, or SMTP credential in browser code.

## Local test

Serve the repository over HTTP:

```powershell
python -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/management/
```

Test at minimum:

1. Existing administrator signs in and can open `admin.html`.
2. A second teacher signs up, confirms email, and lands on `pending.html`.
3. Administrator approves the second teacher.
4. Approved teacher can add students and sessions.
5. Administrator grants the second approved teacher administrator access.
6. The second administrator can remove the original administrator role without leaving the platform with zero administrators.
7. Suspended teacher is redirected away from private data and database queries are rejected by RLS.
8. Password-recovery link reaches `reset-password.html` and updates the password.
9. Full account export contains students, lesson progress, and sessions.
10. A non-administrator teacher can delete the account after password and `DELETE` confirmation.
11. Audit history records account and administrator review plus management changes without copying private note contents.
12. Teacher generates an assignment, previews/replaces positions, publishes it, and copies a student-specific private link.
13. Student opens the link without a management login, completes positions, and the teacher sees progress and scores.
14. Archive disables access, restore re-enables it, duplicate produces new tokens, and permanent deletion removes all dependent assignment records.
15. Starting a coaching session shows the timer, restores it after a dashboard reload, opens the recommended lesson and Live Board, and prefills duration/lesson when ending.
16. Switching students keeps the active session associated with its original student and requires confirmation before replacing it.
17. Teacher creates a workspace, copies the permanent private link, and the student sees only the selected instructions, homework, lesson, position, Live Board invitation, and published puzzle work.
18. Student completes a workspace puzzle assignment and the same score/progress appears in both the workspace and `/management`.
19. Pausing the workspace blocks the student page; replacing its link blocks the old URL and enables only the new URL.
20. A workspace link for Student A cannot open or save a puzzle-assignment row belonging to Student B.

## Production boundaries

V2.1 provides the application-level hardening controls listed above. Before broad commercial launch, complete the items in [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md), including legal review, custom SMTP, backups, monitoring, incident response, retention rules, and access-control testing.
