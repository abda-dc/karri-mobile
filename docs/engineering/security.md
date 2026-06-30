# Security

## Current threat boundary

The mobile app runs on an untrusted device. Form validation, hidden buttons, feature flags, and TypeScript types improve UX but do not authorize data. Firebase rules and future Cloud Functions enforce trust boundaries.

## Configuration and secrets

Firebase web configuration is public project metadata and is supplied through `EXPO_PUBLIC_FIREBASE_*` variables. The repository commits placeholders only. Service-account JSON, private API keys, signing keys, webhook secrets, and provider credentials must never be exposed through `EXPO_PUBLIC_*` or bundled into the app.

## Current controls

- Safe Firebase initialization refuses partial configuration.
- Owner IDs come from Firebase Auth.
- Profile rules prevent a client from assigning or changing the reserved trust-score field.
- Firestore rules constrain listing ownership, mutable fields, types, and active marketplace reads.
- Lifecycle rules use participant membership, immutable identifiers, finite transitions, deterministic IDs, and server timestamps; unspecified access defaults to deny.
- Custody/review updates and deletes and all `trustScores` access remain denied.
- Storage defaults to deny because no upload flow is implemented.
- Listener and write errors are shown without exposing configuration values.
- Server timestamps prevent clients from choosing audit timestamps.
- The controlled Expo adapter may obtain a token only after explicit authenticated intent. It does not display/log the token or write it directly to Firestore; trusted persistence and delivery remain deferred. Push registrations are secrets, so direct client collection access and client-side provider delivery remain prohibited.

## Known MVP limitations

- Anonymous Auth is a development bridge, not verified identity.
- App Check is not yet enabled.
- Rules require emulator/deployed-project validation before launch.
- No abuse throttling, moderation, prohibited-item enforcement, or upload scanning exists.
- Active listings expose route and package summary data to any authenticated user; fields must remain intentionally minimal.
- Calendar strings do not yet capture timezone or airport-level precision.

## Before a production pilot

1. Choose and test a verified authentication provider and account recovery.
2. Enable App Check with enforcement staged and monitored.
3. Test Firestore/Storage rules in the Emulator Suite, including denied cases.
4. Move booking and custody commands to functions with idempotency and audit events.
5. Define data retention, deletion, incident response, prohibited items, and evidence access.
6. Add dependency, secret, and static checks to CI.
7. Complete privacy, legal, and corridor safety review.

Native push activation additionally requires the token, payload, authorization, credential, retention, and kill-switch gates in [Notification Delivery](../architecture/notification-delivery.md).

## Logging

Prefer stable IDs, action names, and outcome codes. Do not log auth tokens, package descriptions, addresses, uploaded evidence, or private profile fields unless an approved support workflow requires tightly controlled access.
