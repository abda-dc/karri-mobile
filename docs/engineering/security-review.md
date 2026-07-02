# Security Review

## Review scope

This review covers the Milestone 10 mobile MVP: authentication bridge, active marketplace listings, explainable matching, booking and custody lifecycle, notifications, reviews, identity metadata, trust projections, offline behavior, error reporting, and Expo/Firebase dependency boundaries.

The mobile client is untrusted. UI state, TypeScript types, hidden controls, scores, and client timestamps are not authorization.

## Security and privacy posture

### Authentication and authorization

- Firebase Auth supplies the current UID; anonymous sign-in is a development bridge, not verified identity.
- Firestore rules enforce ownership, participant scope, allowed fields, finite lifecycle transitions, deterministic IDs, and server timestamps.
- Booking and custody actions repeat domain/application validation, but production multi-party commands still require trusted server transactions and idempotency.
- App Check is not enforced and must be staged before production exposure.

### Data minimization

- Active listings contain route and package-summary fields needed for marketplace discovery. They must not include contact details, recipient addresses, travel documents, or private messages.
- Identity verification stores metadata-only records. Storage remains deny-all; document bytes, OCR, public URLs, and identity numbers are not supported.
- Other-user trust uses reviews-only evidence. Matching does not probe private identity documents; unavailable verification is explicit.
- Custody events are audit-friendly participant records, not proof of physical reality.

### Configuration and secrets

- `EXPO_PUBLIC_FIREBASE_*` values are public Firebase client metadata, not secret credentials.
- Service-account JSON, signing keys, APNs/FCM credentials, Expo access tokens, webhook secrets, private API keys, and identity-provider credentials must never enter the repository or mobile bundle.
- Push token acquisition is explicit and controlled; token persistence and delivery remain deferred. Tokens must not be displayed, logged, or stored in client-readable collections.

### Logging and error privacy

`reportFriendlyError` returns a normalized safe message while reporting an operation name through the application error service. Current console diagnostics may include original error objects in development, so production telemetry must define redaction before activation.

Never log auth tokens, push tokens, identity metadata, package descriptions, private notes, form contents, environment values, or unrestricted provider payloads. Stable IDs, operation names, application codes, retryability, and allowlisted outcome metadata are preferred.

## Architecture review

The intended path is:

```text
screen/component -> mobileServices -> application/domain -> repository port -> Firebase Infrastructure
```

All screens and presentation hooks follow this boundary and contain no direct Firebase/Firestore imports. `AuthSessionService` keeps configuration, start, restore subscription, and sign-out behind the same composition boundary. Infrastructure owns SDK initialization, repositories, mappers, auth persistence, offline network state, and push adapters.

## Dependency and supply-chain review

- Expo SDK packages are patch-aligned and gated by `expo-doctor`.
- `package-lock.json` is committed for reproducible npm resolution.
- Dependency changes require lockfile review; a passing typecheck does not replace SDK compatibility or vulnerability review.
- CI does not yet enforce audit, license, secret scanning, or dependency update policy. Add reviewed tooling before production distribution; do not auto-fix major dependency changes without source review.

## Abuse and misuse review

Current missing controls include rate limiting, App Check, prohibited-item enforcement, upload scanning, moderation, account recovery, fraud review, blocking/reporting, support escalation, and automated anomaly detection. Trust and matching scores must not become sole safety, authorization, pricing, or enforcement decisions.

The app has no payments, disputes, carrier integration, maps, GPS, proof upload, or admin dashboard. Adding any of those materially changes the threat model and requires a separate review.

## Required beta evidence

- Firestore Emulator allow/deny tests for users, profiles, listings, bookings, custody, reviews, notifications, preferences, and identity verification.
- Cross-account tests proving one participant cannot read private identity/profile/notification data or mutate another participant's records.
- Reconnect and stale-state tests proving rejected client writes do not produce misleading confirmed UI.
- Secret scan and manual review of Expo/Firebase configuration, native credentials, and environment separation.
- Device tests for sign-out/session transitions, offline cache exposure, notification permission denial, and local data after account changes.
- Accessibility testing so security/consent/status meaning is not conveyed by color alone.
- Privacy/legal approval for route visibility, retention, deletion, identity metadata, reviews, and beta support access.

## Findings

| Finding | Current disposition |
| --- | --- |
| Anonymous development authentication | External beta blocker in the validated project: provider returned `auth/admin-restricted-operation`; enable the documented bridge or replace it |
| App Check absent | Open; stage and monitor enforcement |
| Client-orchestrated multi-party writes | Open; migrate to trusted idempotent commands |
| Presentation Firebase imports | Closed in Milestone 11; auth bootstrap now uses `AuthSessionService` through composition |
| Rules lack automated emulator suite | Open beta gate |
| Production telemetry/redaction absent | Open before external beta growth |
| Push persistence/delivery absent | Deferred and fail-closed |
| Identity evidence/upload/reviewer workflow absent | Deferred and Storage deny-all |
| Trust/matching non-authoritative | Accepted decision-support limitation with visible explanations |

## Decision

Automated compilation, documentation, and Firestore rule-load checks support a controlled internal beta candidate, but they do not close the manual security gates above. External beta is not approved while the configured authentication bridge fails, rules lack allow/deny tests, and the cross-account/device/privacy gates remain open.

## Related documents

- [Release Hardening](release-hardening.md)
- [Security](security.md)
- [Authorization](authorization.md)
- [Identity Verification](../architecture/identity-verification.md)
- [Trust Engine](../architecture/trust-engine.md)
- [Notification Delivery](../architecture/notification-delivery.md)
