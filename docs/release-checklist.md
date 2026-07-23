# Release Checklist

## Candidate identity

- [ ] Exact source SHA: `____________________________`
- [ ] Release environment/profile: `____________________________`
- [ ] Repository branch and remote SHA match the approved candidate.
- [ ] Index and tracked working tree are clean; all untracked paths are reviewed.
- [ ] Named release approver: `____________________________`

## Automated evidence

- [ ] Mobile Validate run ID, `headSha`, and success recorded.
- [ ] Firebase Validate run ID, `headSha`, and success recorded, or path-filter non-trigger is explicitly accepted with equivalent local validation.
- [ ] Publish Docs run ID, `headSha`, and success recorded.
- [ ] Azure Static Web Apps run ID and exact-SHA result recorded if the web surface is in scope.
- [ ] Local `mkdocs build --strict`, mobile typecheck/tests, Functions build/tests, Firestore rules tests, Storage validation, `git diff --check`, and secret scan pass.

## Backend and security

- [ ] Source Firebase exports are compared with deployed functions by exact name and environment.
- [ ] Any implemented-but-not-deployed function is explicitly accepted or deployed under separate approval.
- [ ] Firestore/Storage rules and index revisions are recorded.
- [ ] App Check decision is recorded: monitoring/enforcement mode, evidence, owner, and rollback. Enforcement is not enabled by default.
- [ ] Push decision is recorded. `KARRI_PUSH_DELIVERY_ENABLED` remains off unless a dated production approval exists.
- [ ] Production push checklist is complete; otherwise decision is **No-Go**.
- [ ] Incident owner, monitoring, credential rotation, and rollback contacts are named.

## Environment completeness

- [ ] Required EAS variable names/scopes are present without recording values.
- [ ] Development, preview, and production projects/credentials cannot be mixed.
- [ ] Preview/production EAS project-variable gaps are closed. They are missing as of July 23, 2026.
- [ ] Firebase, EAS, Apple, Google Play, GitHub, and Azure receiving-owner access is independently verified.

## Native builds and acceptance

- [ ] Current-SHA Android build ID: `____________________________`
- [ ] Current-SHA iOS build ID: `____________________________`
- [ ] Android/iOS identifiers equal `com.karrimobile.app`.
- [ ] Physical Android acceptance evidence is attached to the release record.
- [ ] Physical iPhone acceptance evidence is attached to the release record.
- [ ] Accessibility, offline/reconnect, auth/session, N4B sign-out cleanup, notification permission/registration, and account-switch cases are exercised on the exact candidates.
- [ ] Historical builds/runs are labeled historical and are not substituted for current-SHA evidence.

## Store decisions

- [ ] Android Play track: `____________________________`
- [ ] Android release status (`draft` unless separately approved): `____________________________`
- [ ] Android signing and Play upload owners approve.
- [ ] iOS App Store/TestFlight build and submission evidence: `____________________________`
- [ ] Apple signing/recovery and App Store Connect owners approve.

## Legal and support

- [ ] Owner/legal approves final privacy notice (`PRIVACY.md` decision unresolved).
- [ ] Owner/legal approves terms (`TERMS.md` decision unresolved).
- [ ] Owner/legal approves license (`LICENSE` decision unresolved).
- [ ] Data retention/deletion, prohibited items, support, incident, and user communication procedures are approved.

## Rollback and decision

- [ ] Known-good native build/update/backend revisions are identified.
- [ ] Firebase, EAS Update, Static Web Apps, Android containment, push shutdown, and App Check rollback procedures are reviewed.
- [ ] Rollback authority and communication owner are named.
- [ ] Final decision: **Go / No-Go**
- [ ] Decision date/time and approvers: `____________________________`
- [ ] Any exception has a written risk owner, expiry, containment, and follow-up date.

No release is approved by an unchecked template. Missing current-SHA builds, device evidence, environment variables, legal decisions, production push approval, or rollback ownership requires **No-Go**.
