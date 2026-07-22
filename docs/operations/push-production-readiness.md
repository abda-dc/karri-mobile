# Production Push Readiness Checklist

## Status

**Production push authorization: Not granted.**

The current N1-N4A package supplies controlled client registration, trusted token persistence, bounded `booking.accepted` server delivery, registration-generation binding, and explicit current-installation unregistration. It does not supply production credentials, receipt polling, retries, queues, workers, schedulers, automatic lifecycle reconciliation, App Check enforcement changes, monitoring, real-device acceptance evidence, provider enablement, or production approval.

Every required checkbox below must have an owner, dated evidence, environment, and reviewer. A build passing TypeScript or Expo Doctor is not production approval.

## Client and EAS Build

- [x] SDK-compatible `expo-notifications` package is installed.
- [x] Config plugin is present with background remote notifications explicitly disabled.
- [x] Permission/token registration requires an authenticated, explicit Profile action and saved Push preference.
- [x] Web and missing-EAS-project builds fail closed.
- [x] Tokens are not displayed or logged by the client foundation.
- [ ] Stable Android package and iOS bundle identifiers are approved.
- [ ] EAS project ID is committed as reviewed non-secret configuration for each app identity.
- [ ] Development, preview, and production build profiles use separate Firebase/EAS environments.
- [ ] Notification plugin/native config changes have been rebuilt into signed binaries; no OTA-only activation is attempted.
- [ ] Release provenance, signing ownership, supported OS versions, and rollback artifact are documented.

## Android channels and FCM

- [x] `karri_activity_v1` and `karri_announcements_v1` have stable, versioned purposes.
- [x] Channels are created only inside the explicit registration action and before token acquisition.
- [x] No exact-alarm, background-task, custom-sound, or high-importance behavior is enabled.
- [ ] Names, descriptions, importance, sound, vibration, badge, and lock-screen behavior are product/privacy approved on real devices.
- [ ] Firebase Android apps match each application ID and environment.
- [ ] FCM HTTP v1 API is enabled in each required project.
- [ ] Matching `google-services.json` public metadata is reviewed; no service-account JSON is committed.
- [ ] Least-privilege FCM v1 service-account credentials are uploaded to the correct EAS project/environment.
- [ ] Sender/project mismatch, credential revocation, and rotation drills pass.

## iOS permission and APNs

- [x] The client distinguishes not-determined, denied, authorized, provisional, ephemeral, and unsupported states.
- [x] Approved in-app explanation appears before the only permission-triggering button.
- [x] Denied permission does not cause repeated prompts or automatic Settings navigation.
- [ ] Final permission copy is approved by Product, Privacy, and Legal and matches actual behavior.
- [ ] App Store privacy disclosures, review notes, screenshots, and support copy describe optional notifications accurately.
- [ ] Paid Apple Developer team, bundle ID, push entitlement, provisioning profiles, registered test devices, and APNs key are ready.
- [ ] APNs key ownership, scope, rotation, revocation, and emergency replacement are rehearsed.
- [ ] Development and production APNs environments cannot be mixed.

## Secrets and trusted server delivery

- [x] No FCM/APNs/server secret is present in mobile code, `EXPO_PUBLIC_*`, Firestore, docs examples, or the repository.
- [x] Mobile delivery remains unavailable; the bounded provider path exists only in trusted server code behind a default-off kill switch.
- [x] Authenticated registration/unregistration endpoints run in trusted server code and derive user identity from verified authentication.
- [x] Emulator tests prove clients cannot directly read or write token and delivery collections.
- [ ] Deployed production rules and IAM evidence prove token and delivery collections remain server-only.
- [ ] Expo Push Service access token/enhanced security is enabled if Expo transport is selected.
- [ ] All provider credentials use managed secret storage, least privilege, access audit, rotation owner, and break-glass procedure.
- [x] The trusted `booking.accepted` materializer creates the canonical in-app notification before optional dispatch.
- [x] The trusted dispatcher alone evaluates recipient registrations and sends the bounded provider request.
- [x] A server-only default-off control can disable dispatch independently.
- [ ] Registration, category, cohort, and environment emergency controls are designed and operationally tested.

## Token lifecycle and cleanup

- [x] Client token model validates user, installation ID, platform/provider, timestamp, and value bounds.
- [x] Expo automatic token-update mode is disabled by the controlled gateway.
- [x] Profile offers explicit current-installation unregistration using the authenticated user plus the retained installation ID; removal needs no raw token and sends only `deviceId` to the trusted callable.
- [x] Missing installation state is an idempotent no-op, malformed state fails closed, and successful removal retains the installation ID for later registration reuse.
- [x] The registration endpoint transactionally upserts the installation binding and maintains a server-owned positive `registrationVersion`.
- [x] First registration starts at `1`; the same active token preserves its version; token replacement and inactive reactivation increment it.
- [x] A missing legacy version upgrades to `1`; malformed or exhausted version state fails closed without overwriting the registration.
- [ ] Foreground/token-change reconciliation is designed, user-consented, bounded, and tested before enabling any listener.
- [ ] Sign-out calls authenticated cleanup before session teardown, continues safely if offline, and records a non-secret retry tombstone.
- [ ] Account deletion deactivates every installation.
- [x] Immediate Expo `DeviceNotRegistered` cleanup requires the current token and captured `registrationVersion` to match, preserving a newer generation.
- [ ] Receipt-polled `DeviceNotRegistered`, FCM `UNREGISTERED`, and equivalent permanent results use the same generation-safe cleanup rule.
- [ ] `INVALID_ARGUMENT` is treated as invalid-token evidence only after independent payload validation.
- [ ] Registration leases, freshness review, inactive-token deletion, tombstone retention, and data-subject deletion are approved and automated.

## Preferences and quiet hours

- [x] Stored Push preference remains separate from platform permission and token state.
- [x] Push and every channel default off; Email/SMS remain unavailable.
- [ ] Server maps every event to one versioned preference category and channel.
- [ ] Missing, invalid, stale, or unreadable preferences fail closed before token lookup.
- [ ] Latest preferences are re-read immediately before send and retry.
- [ ] Quiet hours are evaluated server-side with IANA/DST-aware logic, start-inclusive/end-exclusive semantics, and overnight coverage.
- [ ] Deferred sends re-evaluate preference, token, event age, and quiet hours at wake time.
- [ ] No quiet-hours bypass/critical category exists without separate product, legal, privacy, security, and abuse approval.

## Payload privacy and deep-link authorization

- [x] Schema-v1 payload validator accepts only `schemaVersion`, `notificationId`, `action`, and conditional `bookingId`.
- [x] Typed examples cover every supported action and route resolution without navigation.
- [x] Extra private/content/URL fields fail validation.
- [ ] Locked-screen title/body copy is generic and approved for every locale.
- [ ] Server validates the exact allowlisted schema and payload-size ceiling before send.
- [ ] Client revalidates payload after receipt.
- [ ] Tap handling requires authentication, loads the recipient-scoped canonical notification, verifies ownership/participation, and falls back safely.
- [ ] No payload-supplied URL, user ID, role, booking status, or destination is treated as authority.
- [ ] Authorization tests cover signed out, wrong user, deleted notification, revoked booking access, malformed payload, and stale action.

## Abuse prevention and security review

- [ ] Registration/unregistration endpoints enforce authentication, App Check rollout policy, rate limits, schema validation, environment binding, and replay protection.
- [ ] Dispatch enforces per-user, per-installation, per-category, and global rate limits plus provider concurrency limits.
- [ ] Topic/broadcast sending is disabled unless separately designed and approved.
- [x] Current deterministic notification/delivery IDs contain no token or private content, and delivery effects capture only the non-secret registration generation.
- [ ] Future retry, receipt, and projection-version effect IDs are collision-tested under their final schemas.
- [ ] Threat model covers modified clients, forged payloads, leaked tokens, credential misuse, notification spam, enumeration, cross-environment tokens, and operator abuse.
- [ ] Mobile, Firestore rules, Cloud Functions, IAM/service accounts, dependencies, and secret scanning pass security review.
- [ ] Support/admin tools are least-privilege, audited, and unable to reveal raw tokens by default.

## Retry, receipts, monitoring, and dead letters

- [x] Immediate provider ticket outcomes are persisted without raw token or private body, with the selected `registrationVersion`.
- [ ] Provider receipts are polled and persisted as outcome metadata without raw token or body.
- [x] Provider acceptance is never reported as device/user receipt.
- [ ] Receipt cleanup compares the effect's captured generation with the current registration before token deletion or deactivation.
- [ ] Only network errors, timeouts, HTTP 429/5xx, and provider rate limits retry with capped exponential backoff and jitter.
- [ ] Invalid credentials, malformed/oversized payloads, sender mismatch, unauthorized requests, and deterministic schema errors fail permanently and alert.
- [ ] Retry attempts, maximum delivery age, terminal states, dead-letter transition, and operator replay checks match the delivery design.
- [ ] Dashboards cover materialization lag/failure, active/stale tokens, policy suppression, quiet-hour deferral, provider acceptance, missing receipts, retries, invalid tokens, permanent failures, and dead letters.
- [ ] Alerts have tested thresholds, owners, runbooks, escalation, and redacted diagnostic fields.
- [ ] Provider outage and stuck-queue exercises pass without losing canonical in-app notifications.

## Privacy and data governance

- [ ] Data inventory identifies token, token hash, installation ID, permission state, event/effect IDs, receipt IDs, timestamps, and operator access.
- [ ] Purpose, legal basis/consent model, disclosures, retention, deletion, access, export exclusions, subprocessors, and regional transfer are approved.
- [ ] Token encryption at rest and possible application-level/KMS encryption are reviewed.
- [ ] Logs, traces, analytics, crash reports, screenshots, support exports, and dead letters are proven free of tokens/private payloads.
- [ ] Successful delivery metadata and failure/dead-letter retention periods are approved and automatically enforced.
- [ ] Incident response includes token/credential exposure, unauthorized sends, abusive content, and privacy requests.

## Real-device test matrix

- [ ] Real Android devices cover supported OS/API versions, fresh allow/deny, existing denial, channel changes, background, foreground, terminated launch, reinstall, upgrade, offline registration, and credential mismatch.
- [ ] Android emulator with Google Play services passes the controlled development checklist; emulator without Play services fails safely.
- [ ] Real iPhones cover supported iOS versions, all relevant authorization states, Settings changes, background, foreground, terminated launch, reinstall, upgrade, offline registration, and APNs environment mismatch.
- [ ] Supported iOS Simulator smoke tests are supplemental and never replace real iPhone evidence.
- [ ] Accessibility, localization, lock-screen preview, Focus/Do Not Disturb, badge/sound, battery/network, and account-switch behavior are reviewed.
- [ ] Development, preview, and production credentials are tested only with matching builds/projects.

## Rollout and rollback

- [ ] Server collections/rules/functions deploy with sending disabled and rollback tested.
- [ ] Internal staff registration-only cohort passes before any send.
- [ ] One low-volume category and small preview cohort pass receipt/privacy/support review.
- [ ] Expansion uses measured category/cohort gates with daily go/no-go owners.
- [ ] Announcements/broadcasts remain disabled until separately approved.
- [ ] Rollback can stop dispatch immediately without app release, disable registration separately, drain/quarantine queues, preserve canonical records, and deactivate exposed tokens.
- [ ] Credential compromise rollback rotates secrets and proves old credentials cannot send.
- [ ] User/support communication templates exist for outage, rollback, mistaken send, and permission changes.

## Go/no-go decision

Go requires all of the following:

- [ ] Every required checkbox above is complete with evidence and owner.
- [ ] Product owner approves copy, categories, rollout, and support readiness.
- [ ] Engineering owner approves architecture, reliability, rollback, and operational readiness.
- [ ] Security owner approves threat model, IAM, secrets, abuse controls, and test evidence.
- [ ] Privacy/Legal owner approves disclosures, payloads, retention, deletion, and subprocessors.
- [ ] Mobile release owner approves signed builds and real-device matrix.
- [ ] Backend/SRE owner approves sender, queues, monitoring, alerts, runbooks, and credential rotation.
- [ ] Final decision records environment, build, server revision, rules revision, credentials, cohort, date, and approvers.

Automatic no-go conditions:

- Any production secret or raw token is committed, bundled, displayed, or logged.
- Any permission prompt, token registration, send, listener, or navigation occurs without the documented user/server gate.
- A client can provide, overwrite, or read the server-owned registration generation.
- A delayed or immediate failure can deactivate a registration whose token or `registrationVersion` no longer matches the attempted send.
- Client code can select arbitrary recipients or deliver directly.
- Preference, quiet-hours, authentication, or authorization checks can be bypassed.
- Canonical in-app notification creation depends on push success.
- Emulator/rules/function tests, real-device matrix, monitoring, incident response, or rollback evidence is incomplete.
- Production and development credentials/projects can be mixed.

Until a dated decision satisfies every condition, the status remains **No-Go**.
