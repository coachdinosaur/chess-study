# Management Production Checklist

## Authentication and accounts

- [ ] Email confirmation is enabled.
- [ ] Custom SMTP is configured and tested for confirmation and recovery messages.
- [ ] Production and local redirect URLs include `pending.html` and `reset-password.html`.
- [ ] Password-change security notification email is enabled when available.
- [ ] At least two trusted platform administrators exist before the original administrator is replaced or removed.
- [ ] Granting administrator access and removing a non-final administrator are tested.
- [ ] Pending, approved, and suspended account flows are tested in separate browser profiles.

## Database and access control

- [ ] Migrations 001 through 009 are present in production.
- [ ] RLS tests verify Teacher A cannot read or modify Teacher B's students, progress, or sessions.
- [ ] Suspended teachers cannot read or write private coaching records.
- [ ] Administrator RPCs reject ordinary teachers.
- [ ] The final platform administrator cannot be removed or self-delete.
- [ ] Audit events avoid storing complete private note contents.
- [ ] Database backups are enabled and a restoration has been tested.

## Privacy and children

- [ ] A qualified reviewer has replaced the operational privacy notice with the final policy for the countries served.
- [ ] A retention schedule exists for inactive teacher and student records.
- [ ] Teachers receive clear instructions about guardian permission and data minimisation for minors.
- [ ] A process exists for correcting, exporting, and deleting records on a valid request.
- [ ] The list of hosting and database subprocessors is published.

## Operations

- [ ] Error and uptime monitoring is configured.
- [ ] Security and privacy contacts are published.
- [ ] An incident-response procedure identifies who investigates, contains, documents, and communicates a breach.
- [ ] A staging Supabase project is used for schema and RLS changes before production.
- [ ] Migration rollback and emergency access-revocation procedures are documented.
- [ ] Rate limits, abuse controls, and bot protection are reviewed before open registration is promoted publicly.

## Release validation

- [ ] Sign-up, confirmation, approval, sign-in, password reset, suspension, restoration, export, deletion, and administrator transfer are browser-tested.
- [ ] Desktop, tablet, and mobile layouts remain usable.
- [ ] Keyboard navigation and visible focus states are tested.
- [ ] No secret keys or credentials appear in repository files or browser storage.
