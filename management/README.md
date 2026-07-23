# Teacher Lesson Tracker

This directory provides a private teacher dashboard for the framework-free CD Digital Chess site. GitHub Pages or another static host serves the HTML, CSS, and JavaScript. Supabase supplies teacher authentication, PostgreSQL storage, and Row Level Security.

## Current workflow

- Teachers create an email/password account and sign in.
- Teachers add private student records directly.
- Students do not create management accounts, supply email addresses, join with class codes, or open the management dashboard.
- Teachers can search active or archived students, archive records, and restore them later.
- Teachers select a student and track each curriculum lesson as:
  - Not yet taught
  - Taught
  - Needs practice
  - Completed
- The curriculum can be filtered by lesson text, level, or teaching status.
- Teachers record dated coaching sessions with an optional linked lesson, duration, notes, homework, and next step.
- Teachers can save general student notes and export one student's lesson progress and coaching sessions to CSV.
- Students continue using public lesson links and the Live Board links shared by the teacher.

## Current files

- `index.html` — management landing page
- `login.html` — teacher registration and sign-in
- `teacher.html` — private student, curriculum, and coaching-session tracker
- `js/teacher-dashboard.mjs` — student records, search, archive/restore, lesson status, session log, and CSV export
- `js/lesson-catalog.mjs` — curriculum generated from the existing lesson indexes
- `js/supabase-client.mjs` — shared authenticated Supabase client
- `js/config.mjs` — public Supabase project URL and publishable key
- `teacher-search.css` — teacher dashboard filters and coaching-session layout

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
supabase/migrations/005_coaching_sessions.sql
```

Migration `004_teacher_managed_students.sql` adds:

- `managed_students`
- `managed_student_lesson_progress`
- `teacher_lesson_status`

Migration `005_coaching_sessions.sql` adds:

- `coaching_sessions`
- teacher-owned Row Level Security policies
- indexes for teacher and student/date lookups

The earlier migrations remain because migrations 004 and 005 depend on shared profile, trigger, and teacher-policy helpers created by them. Their older class and assignment tables are retained for migration safety but are not used by the current teacher dashboard.

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

## 5. Minimum browser test

1. Sign in as a teacher.
2. Add a student and save general notes.
3. Search for a lesson and change its status.
4. Filter the curriculum to `Needs practice`.
5. Add, edit, and delete a coaching-session record.
6. Export the student CSV and confirm lesson-progress and coaching-session rows are present.
7. Archive the student, switch to Archived, and restore the student.
8. Refresh the page and confirm all saved records remain.
