# Teacher Lesson Tracker

This directory provides a private teacher dashboard for the framework-free CD Digital Chess site. GitHub Pages or another static host serves the HTML, CSS, and JavaScript. Supabase supplies teacher authentication, PostgreSQL storage, and Row Level Security.

## Current workflow

- Teachers create an email/password account and sign in.
- Teachers add private student records directly.
- Students do not create management accounts, supply email addresses, join with class codes, or open the management dashboard.
- Teachers select a student and track each curriculum lesson as:
  - Not yet taught
  - Taught
  - Needs practice
  - Completed
- Teachers can save general student notes and lesson-specific notes.
- Students continue using public lesson links and the Live Board links shared by the teacher.

## Current files

- `index.html` — management landing page
- `login.html` — teacher registration and sign-in
- `teacher.html` — private student and curriculum tracker
- `js/teacher-dashboard.mjs` — student records, notes, lesson status, and archiving
- `js/lesson-catalog.mjs` — curriculum generated from the existing lesson indexes
- `js/supabase-client.mjs` — shared authenticated Supabase client
- `js/config.mjs` — public Supabase project URL and publishable key

The retired anonymous student join page, student dashboard, and their JavaScript files are intentionally removed. The current product does not use that workflow.

## 1. Configure Supabase authentication

In the Supabase dashboard:

1. Enable Email authentication.
2. Set the Site URL to the deployed site, such as `https://cddigital.top`.
3. Add local development redirect URLs, such as `http://127.0.0.1:8000` and `http://localhost:8000`.
4. Decide whether teacher email confirmation is required.

Anonymous Sign-Ins are not required by the current management dashboard.

## 2. Apply database migrations

Run these files in order through the Supabase SQL editor or CLI:

```text
supabase/migrations/001_management_v1.sql
supabase/migrations/002_management_v1_hardening.sql
supabase/migrations/003_management_v1_rpc_shapes.sql
supabase/migrations/004_teacher_managed_students.sql
```

Migration `004_teacher_managed_students.sql` adds the tables used by the current dashboard:

- `managed_students`
- `managed_student_lesson_progress`
- `teacher_lesson_status`

The earlier migrations remain because migration 004 depends on shared profile, trigger, and teacher-policy helpers created by them. Their older class and assignment tables are retained for migration safety but are not used by the current teacher dashboard.

## 3. Configure the static frontend

Edit:

```text
management/js/config.mjs
```

Set the Supabase project URL and browser-safe publishable key:

```javascript
export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

Never place a service-role key, database password, or other secret in browser code.

## 4. Serve locally

From the repository root:

```powershell
python -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/management/
```

Do not open the management pages through `file://`, because browser modules and authentication redirects require HTTP.

## 5. Manual test

1. Open `/management/login.html`.
2. Create or sign in to a teacher account.
3. Add a test student.
4. Select the student.
5. Change several lesson statuses.
6. Save general notes and any lesson notes.
7. Refresh the page and confirm the records persist.
8. Sign out, sign back in, and confirm the same teacher can still access the student.
9. Archive the test student and confirm the lesson history remains available as intended.

## Security boundaries

- The frontend contains only the Supabase project URL and publishable key.
- No service-role key belongs in this repository or browser storage.
- Teachers can access only student records they own.
- Lesson progress is accessible only through the owning teacher's authenticated account.
- Students never receive access to the teacher dashboard or its private notes.

## Known limitations

- Teacher registration is currently open. Before broad commercial launch, add administrator approval or invitation-only onboarding.
- The dashboard tracks teacher-recorded progress rather than automatically grading students.
- Production use still needs database backups, privacy terms, abuse protection, and testing against the deployed Supabase project.

## Recommended next slice

Connect each curriculum entry to the teaching workflow:

```text
Teacher dashboard → open lesson → present lesson → open position in Live Board → record the result
```
