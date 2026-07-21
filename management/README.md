# Chess Coaching Management V1

This directory adds a static teacher–student management portal to the existing framework-free chess study site. GitHub Pages or another static host serves the HTML, CSS, and JavaScript. Supabase supplies authentication, PostgreSQL data, and Row Level Security.

## Included in this V1 slice

- Teacher email/password registration and sign-in
- Anonymous student sign-in without a student email
- Teacher-created classes with eight-character join codes
- Pending student membership and explicit teacher approval
- Lesson-link assignments with instructions and optional due dates
- Student started/completed progress
- Teacher completion counts
- Database schema, RPC functions, and Row Level Security policies

Not included yet:

- Study Board lesson snapshots
- Course-catalog assignment picker
- Teacher feedback UI (the secured table is prepared)
- Guardian-email account recovery
- Attendance, scheduling, payments, chat, certificates, or Lichess synchronization

## 1. Create a Supabase project

Create a Supabase project and record:

- Project URL
- Publishable key

Do not use or commit a secret key, service-role key, or database password in browser code.

## 2. Configure authentication

In the Supabase dashboard:

1. Enable Email authentication.
2. Enable Anonymous Sign-Ins.
3. Set the Site URL to the deployed site, for example `https://cddigital.top`.
4. Add the local development URL to Redirect URLs, for example `http://127.0.0.1:8000`.
5. Decide whether teacher email confirmation is required. The current UI supports both immediate sessions and confirmation-email flow.

Anonymous student accounts belong to the browser session. Clearing browser storage, signing out, or changing devices can make the account unrecoverable until guardian-email linking is implemented.

## 3. Apply database migrations

Run these files in order through the Supabase SQL editor or CLI:

```text
supabase/migrations/001_management_v1.sql
supabase/migrations/002_management_v1_hardening.sql
```

The migrations create:

- `profiles`
- `classes`
- `class_members`
- `assignments`
- `assignment_progress`
- `teacher_feedback`
- teacher-only and student-only RLS policies
- secured functions for class creation, code rotation, joining, approval, and removal

## 4. Configure the static frontend

Edit:

```text
management/js/config.mjs
```

Replace:

```javascript
export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

The publishable key is intended for browser use. Security depends on the database policies, not on pretending the publishable key is secret.

## 5. Serve locally

From the repository root:

```powershell
python -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/management/
```

Do not open these pages through `file://` because browser modules and authentication redirects require HTTP.

## 6. Manual vertical-slice test

Use two separate browser profiles or one normal window and one private window.

### Teacher

1. Open `/management/login.html`.
2. Create a teacher account.
3. Confirm the email if enabled.
4. Sign in.
5. Create a class.
6. Copy the generated class code.

### Student

1. Open `/management/join.html` in a separate browser profile.
2. Enter the class code and a student nickname.
3. Confirm that the dashboard shows pending approval.

### Teacher approval and assignment

1. Return to the teacher dashboard.
2. Approve the pending student.
3. Publish a lesson-link assignment using an existing lesson URL.

### Student progress

1. Refresh the student dashboard.
2. Open the assignment.
3. Return to the dashboard and mark it complete.
4. Confirm that the teacher dashboard reports the completed count.

## Security boundaries

- The frontend contains only the Supabase project URL and publishable key.
- No service-role key belongs in this repository or browser storage.
- Teachers can access only classes they own.
- Students can access only active classes they belong to.
- Students can write only their own progress.
- Teachers can see progress only for assignments in their classes.
- Class joining and approval run through security-definer database functions with explicit ownership checks.

## Known V1 limitations

- Teacher registration is open. Before broad public launch, add administrator approval or an invitation-only teacher onboarding function.
- Student accounts are browser-bound until account linking is added.
- Assignment creation currently accepts a manually entered lesson URL.
- Progress is based on an explicit student action, not automated grading.
- Production use still needs database backup procedures, abuse protection such as CAPTCHA, privacy terms, and testing against the actual Supabase project.

## Planned next slice

1. Generate a course catalog from the existing lesson index arrays.
2. Replace manual lesson URLs with a searchable assignment picker.
3. Add an `Assign to class` bridge from the Study Board lesson JSON serializer.
4. Add teacher feedback controls.
5. Add guardian-email linking and account recovery.
