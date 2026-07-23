# Release Hardening

## Purpose

Milestone 10 prepares the current Karri Mobile MVP for controlled beta evaluation. It aligns the Expo dependency set, improves reusable-control accessibility, reviews failure and UI-state behavior, records architecture and privacy boundaries, and defines release gates.

This document is readiness evidence, not production authorization. Manual device, authorization, privacy, and operations gates remain separate from automated build checks.

## Expo dependency alignment

The mobile package uses Expo SDK 56-compatible patch versions:

| Package | Required range |
| --- | --- |
| `expo` | `~56.0.13` |
| `expo-constants` | `~56.0.19` |
| `expo-notifications` | `~56.0.19` |
| `expo-router` | `~56.2.12` |

`package.json` and the root entries in `package-lock.json` must agree. `npx expo-doctor` is the release gate for SDK compatibility; dependency changes are not considered aligned merely because TypeScript compiles.

## Accessibility hardening

The reusable control layer now provides:

- `PrimaryButton`: optional accessibility label and hint, inferred label for string children, button role, busy/disabled state, minimum touch target, and loading indicator.
- `Badge`: optional accessible label and one grouped text element for screen readers.
- `StatusChip`: optional accessible label and grouped text role; its decorative color dot is hidden from accessibility services.
- Match-score badges and timeline rows expose grouped text labels while decorative timeline rails/icons stay hidden.
- Inline loading states expose progress semantics, and tab labels allow operating-system font scaling.

Color remains supplemental. Labels carry status meaning, and consumers can provide a clearer accessibility label when visible copy is abbreviated. Beta device testing must still cover VoiceOver, TalkBack, font scaling, focus order, switch announcements, keyboard navigation on web, and contrast in both theme modes.

## Error-handling review

Screens and presentation hooks use `reportFriendlyError(error, operation)` for caught application/provider failures. The helper:

1. normalizes domain and provider errors through `ApplicationErrorService`;
2. reports an operation identifier for diagnostics;
3. returns only the safe message and recovery guidance to presentation.

Raw Firebase codes, exception messages, stack traces, form data, package descriptions, identity metadata, tokens, and configuration values must not be interpolated into user banners. Background failures use `reportApplicationError` where no screen owns the error.

Current limitations: logging remains a development console adapter, no production telemetry vendor is configured, and mapper behavior lacks a table-driven automated test suite.

## Loading, empty, and offline consistency

- `LoadingState` is used for authentication checks, listing watches, booking activity, identity data, trust evidence, and ranked recommendations.
- `EmptyState` and `EmptyMatchState` distinguish no data from a failed request and provide context-specific next steps.
- Error banners are separate from empty states; screens do not present a failed read as an empty collection.
- The shared `Screen` shell always renders `OfflineStatusBanner`, keeping offline, pending, syncing, and failed-write messaging consistent.
- Matching cards preserve `live`, `cached`, or `unknown` freshness from `MatchingService`; presentation does not invent freshness or a second cache.
- Optimistic booking/review state remains visibly pending and subscription-driven state remains canonical.

Native Firestore cache remains memory-only and does not survive process termination. Web persistence depends on supported IndexedDB behavior. Neither is described as a durable offline-first system.

## Architecture boundary

Marketplace/tab screens call application services through the singleton `mobileServices` composition. Domain and application matching, booking, custody, trust, identity, notification, and offline logic import no Firebase SDK.

Firebase repositories, mappers, auth adapters, push adapters, and network status live under Infrastructure. Screens, components, hooks, Application, and Domain do not import `firebase/*`, Firestore query functions, Firebase repositories, or provider-shaped payloads. The narrow `mobileServices` and error-service composition modules inject Infrastructure adapters. Bootstrap/session restore, anonymous session start, and sign-out now pass through `AuthSessionService` from that composition root.

N4B binds sign-out to the captured expected user, attempts current-installation push cleanup before Firebase sign-out, fences cleanup with a three-second timeout, and continues sign-out after cleanup failure. Auth operations and push registration operations are serialized; duplicate sign-outs coalesce; timeout invalidation prevents an abandoned registration/unregistration from persisting stale state into a later session. This behavior is covered by source tests but still requires physical-device acceptance.

## Performance review

- Active shipment/trip reads are bounded to 100 records per repository query.
- Matching evidence is loaded once per unique traveler within an evaluation.
- Grouped matching applies result limits per owned shipment/trip and does not persist result collections.
- Realtime watches return unsubscribe callbacks and screen effects clean them up.
- Screen lists remain simple mapped views; virtualization has not been introduced because current bounded/owned datasets are small.
- Matching currently uses bounded Cartesian comparison in memory. Corridor-volume growth requires query narrowing, pagination, profiling, and likely trusted server ranking before increasing limits.
- No image upload, maps, GPS polling, background matching, or push listener increases the current runtime surface.

## Known MVP limitations

- Anonymous authentication remains a development bridge; verified sign-in and recovery are not complete.
- The Firebase project validated on July 2, 2026 returned `auth/admin-restricted-operation`; authenticated external-beta testing is blocked until anonymous auth is enabled there or the bridge is replaced.
- App Check is not enforced.
- Multi-party booking/custody operations remain client-orchestrated rather than trusted idempotent server commands.
- Trusted push registration/unregistration and bounded `booking.accepted` delivery are implemented in source; the three related Functions are not deployed, delivery remains default-off, and production push remains No-Go.
- Identity verification is metadata-only and self-scoped; no KYC provider, upload, reviewer console, or retention job exists.
- Trust and matching are client-calculated decision support, not authorization or safety guarantees.
- Active inventory exposes minimal route/package summary data to authenticated users.
- Native offline state is memory-only.
- Mobile Vitest tests and Firebase rules/Functions emulator suites are part of the repository workflow; physical-device and production-environment evidence remains incomplete.
- Payments, disputes, maps, GPS, proof uploads, carrier integration, and admin tooling remain absent.

## Beta readiness checklist

Milestone 11's detailed evidence, current blockers, and manual matrices live in [Beta Readiness Checklist](beta-readiness-checklist.md).

### Automated release gates

- [ ] `npx expo-doctor` passes every check.
- [ ] `npx tsc --noEmit` passes with strict TypeScript.
- [ ] MkDocs builds successfully.
- [ ] `git diff --check` passes.
- [ ] Final `git status --short` contains only reviewed release-hardening changes before commit and is clean after commit.
- [ ] No secrets, token values, local environment files, or generated site artifacts enter the commit.

### Manual beta gates

- [ ] Android and iOS smoke tests cover sign-in bridge, Send, Travel, discovery, booking lifecycle, Tracking, Profile, offline banners, and reconnect.
- [ ] VoiceOver and TalkBack verify buttons, badges, status chips, fields, switches, loading states, and focus order.
- [ ] Font scaling and narrow-screen layouts remain usable without clipped actions.
- [ ] Firestore rules receive allow/deny Emulator Suite coverage and a deployed-project authorization smoke test.
- [ ] Environment separation, Firebase project ownership, signing credentials, and rollback owners are recorded.
- [ ] Privacy, prohibited-items, retention/deletion, incident-response, and support procedures are approved.
- [ ] Crash/error monitoring is selected with documented redaction before external beta growth.
- [ ] Product owners accept every limitation in this document and [Security Review](security-review.md).

## Release procedure

1. Review the complete diff and dependency lockfile.
2. Run every automated gate from a clean shell.
3. Record warnings or blockers honestly; do not convert a partial check into a pass.
4. Commit the reviewed hardening scope.
5. Run manual/device/security gates on the exact commit candidate.
6. Tag or distribute only after release ownership and rollback steps are confirmed.

## Related documents

- [Security Review](security-review.md)
- [Mobile Architecture](mobile-architecture.md)
- [Error Handling](../architecture/error-handling.md)
- [Offline Strategy](../architecture/offline-strategy.md)
- [Production Push Readiness](../operations/push-production-readiness.md)
