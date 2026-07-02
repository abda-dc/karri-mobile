# Firestore Security Testing

## Why these tests exist

The mobile client is untrusted. TypeScript models, hidden controls, and application-service validation improve usability, but only deployed Firestore Rules define the client authorization boundary. This suite turns that boundary into repeatable allow/deny evidence before rules are reviewed or deployed.

The tests protect ownership, participant privacy, immutable records, finite lifecycle transitions, linked-record invariants, server-owned trust data, and server-timestamp requirements. A denied test is as important as an allowed test: it proves that a forged client write cannot use the same SDK path as a legitimate operation.

## Test architecture

The suite lives under `backend/firebase/tests`:

- `fixtures.ts` provides realistic, deterministic shipment, trip, booking, notification, preference, verification, review, and custody factories. Actors use the stable IDs `senderUid`, `travelerUid`, and `otherUid`.
- `firestore.rules.test.ts` initializes `@firebase/rules-unit-testing`, performs client operations with `assertSucceeds` and `assertFails`, and seeds prerequisites through a rules-disabled admin context.
- `vitest.config.ts` runs one worker with file parallelism disabled. This prevents a test from clearing emulator data while another test is using it.
- `beforeEach` clears Firestore, so every test owns its setup and is independent of execution order.

Admin seeding is limited to prerequisites or server-owned state that is not under test. Allowed client flows still execute through authenticated test contexts and the checked-in rules. Atomic booking/request creation and pending transitions use Firestore write batches because each rule validates the linked document with `getAfter`.

## Emulator isolation

`npm run test:rules` starts only the Firestore Emulator defined by `backend/firebase/firebase.json` on `127.0.0.1:8080`. It always uses the demo project ID `demo-karri-mobile`; Firebase CLI treats demo projects as emulator-only and fails attempts to reach non-emulated services.

The script keeps Firebase CLI configuration and emulator binaries beneath `node_modules/.cache`. It does not read a selected Firebase project alias or production application configuration. Vitest also refuses to initialize when `FIRESTORE_EMULATOR_HOST` is absent.

The first run downloads the official Firestore Emulator JAR and therefore needs network access. Later runs reuse the local cache. Java 21 and Node.js 24 are supported by the pinned tooling.

## Commands

From the repository root:

```powershell
cd C:\Users\Kiya\Documents\karri-mobile
npm ci
npm run test:rules
```

The command starts the emulator, runs Vitest once, stops the emulator, and returns non-zero if the emulator cannot start, the rules cannot load, or any test fails.

To run the complete Milestone 12 verification set:

```powershell
cd C:\Users\Kiya\Documents\karri-mobile
npm run test:rules

cd apps\mobile
npx expo-doctor
npx tsc --noEmit

cd ..\..
.\.venv\Scripts\mkdocs.exe build
git diff --check
git status --short
```

Do not run Vitest directly for rules validation; the npm command supplies the isolated emulator host and project.

## Current authorization coverage

| Area | Allowed evidence | Denied evidence |
| --- | --- | --- |
| Shipments | Owner create/read/update; signed-in active-listing read | Forged owner, non-owner update, inactive cross-user read, delete |
| Trips | Owner create/read/update; signed-in active-listing read | Forged owner, non-owner update, inactive cross-user read, delete |
| Booking requests and bookings | Atomic linked create; sender/traveler reads; every allowed transition | Forged sender, linked mismatch, non-participant access/transition, invalid transition, non-atomic pending transition, delete |
| Notifications | Recipient read/read-state update; valid participant-generated notification | Cross-user read/update, content mutation during read, delete |
| Notification preferences | Self create/read/update | Cross-user access, enabled placeholder channels, unknown categories, delete |
| Identity verification | Self draft create/read/edit and valid submission append | Cross-user access, forged submission event, delete |
| Users and profiles | Self create/read/update | Cross-user access, profile trust-score create/update, delete |
| Reviews and trust | Signed-in review read; completed-booking participant review | Invalid reviewer/subject, incomplete-booking review, all trust-score reads/writes |
| Custody events | Participant read; complete valid seven-event sequence | Non-participant read, missing predecessor, wrong performer, update, delete |

The suite currently contains 49 emulator-backed cases. Transition tables expand into separate cases for every authorized booking state change.

## Adding a test

1. Add or extend a factory in `backend/firebase/tests/fixtures.ts`; keep timestamps and IDs deterministic.
2. Start the test from cleared state and seed only the prerequisite documents it needs.
3. Use an authenticated context for the actor whose authorization is under test.
4. Wrap expected allows with `assertSucceeds` and expected denials with `assertFails`.
5. Use a write batch whenever rules depend on `getAfter` or an invariant spans documents.
6. Add both the legitimate case and the closest forged, cross-user, invalid-transition, or delete case.
7. Run `npm run test:rules` from the repository root.

Avoid shared mutable fixtures, real Firebase project IDs, production credentials, wall-clock-dependent assertions, and rules-disabled writes for the operation being authorized.

## CI integration guidance

A CI rules job should:

1. Install the pinned Node.js version and a compatible Java runtime.
2. Run `npm ci` at the repository root.
3. Optionally restore/cache `node_modules/.cache/firebase/emulators` using the lockfile as part of the cache key.
4. Run `npm run test:rules` with no Firebase token, service account, project alias, or production environment file.
5. Treat any non-zero exit as blocking for changes to `backend/firebase/firestore.rules`, its tests, or Firebase persistence code.

The job can run independently from the Expo typecheck because the root package is intentionally a small rules-test package, not a monorepo workspace.

## Known limitations and remaining gaps

- The Emulator closely models Firestore Rules but is not a production deployment check. Reviewed environments still need controlled rules deployment and smoke validation.
- The suite verifies document authorization, not every mobile collection-query shape, offline-cache behavior, reconnect conflict, or rejected-write presentation state.
- Authentication-provider policy, anonymous-auth availability, App Check, rate limiting, abuse controls, and device session cleanup are outside Firestore Rules.
- Storage remains deny-all and is not covered by this Firestore-only suite. A future identity-evidence workflow needs separate Storage Rules tests before any upload is enabled.
- Admin seeding proves rules around client operations; it does not validate future trusted Cloud Function authorization, transaction idempotency, moderation, or audit tooling.
- Client-orchestrated multi-party booking commands remain an MVP limitation even though linked writes and transitions are rules-tested. Production commands should move to trusted, idempotent server execution.

The valid identity-submission test also guards a Milestone 12 rules correction: update validation now revalidates only client-changeable documents or the appended event. Existing immutable fields remain diff-protected, and the intended submission no longer exceeds Firestore's 1,000-expression evaluation limit.
