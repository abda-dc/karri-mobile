# Beta Readiness Checklist

## Purpose

This checklist records Milestone 11 validation for the current Karri Mobile MVP. It is evidence for a beta decision, not production authorization. Automated checks prove that the source, Expo dependency graph, documentation, and Firestore rules load; they do not replace device, cross-account, accessibility, privacy, or operational testing.

Validation snapshot: July 2, 2026.

## Build

- [x] Expo Doctor: `21/21 checks passed`.
- [x] TypeScript: `npx tsc --noEmit` passes from `apps/mobile`.
- [x] MkDocs: `.\.venv\Scripts\mkdocs.exe build` completes. The Mermaid plugin reports that its remote URL cannot be checked without Internet access, but the build succeeds.
- [x] Firestore emulator starts with the versioned rules and indexes.
- [x] `git diff --check` passes.
- [ ] Final `git status --short` is reviewed before commit. Milestone 11 changes must remain intentionally uncommitted until the owner approves them.

## Architecture

- [x] Presentation calls the provider-neutral `mobileServices` composition rather than Firebase or Expo provider APIs.
- [x] Authentication, booking, shipment, trip, custody, matching, trust, identity, notification, and offline orchestration remain in Application services.
- [x] Domain models and repository interfaces remain provider-neutral.
- [x] Firebase SDK imports remain isolated under Infrastructure; no presentation, application, or domain file imports Firebase directly.
- [x] Firebase repositories own Firestore queries, mappers, timestamps, and listener unsubscribe callbacks.
- [x] Provider/domain failures pass through application error normalization before presentation copy is rendered.
- [x] Offline behavior uses the Firebase SDK queue and platform-specific cache only; no second mutation queue or lifecycle model exists.

## Security

- [x] Firestore rules load in the local emulator without syntax failure.
- [ ] Automated emulator allow/deny tests cover users, profiles, shipments, trips, booking requests, bookings, custody events, reviews, notifications, preferences, and identity verification. No rule test suite exists yet.
- [ ] Cross-account emulator tests prove shipment/trip ownership, booking participation, custody participant visibility, notification ownership, and private identity/profile boundaries.
- [x] Static rule review confirms owner-only inactive shipment/trip access, participant-only booking/custody access, recipient-only notification reads, self-only preferences/identity access, deny-all trust-score persistence, and deny-by-default fallback.
- [x] Repository queries constrain owner, active status, participant field, booking/shipment ID, recipient, review subject, or self document as required by Firestore's non-filtering rules model.
- [x] Source review found only public `EXPO_PUBLIC_FIREBASE_*` placeholders and no committed service-account, signing, push-provider, webhook, or private API credentials.
- [x] Other-user trust remains reviews-only; identity verification records are self-readable, metadata-only, and cannot contain uploaded evidence paths.
- [x] Notification records are recipient-readable and read-state updates are recipient-only; push tokens are not persisted, displayed, or logged.
- [ ] App Check is staged and monitored before broad external exposure.

## Accessibility

- [x] Shared buttons expose button role, inferred/explicit labels, disabled/busy state, hit slop, and minimum target size.
- [x] Preference switches expose switch role plus checked/disabled state and visible descriptive text.
- [x] Status chips, badges, and match-score badges expose text semantics and non-color labels.
- [x] Timeline rows expose one ordered event label while decorative rails/icons are hidden from assistive technology.
- [x] Booking and match cards use headings, plain-language status, and shared accessible controls.
- [x] Shared and inline loading indicators expose progress labels; button spinners inherit the parent button's busy state.
- [x] Tab labels permit operating-system font scaling.
- [ ] VoiceOver validates labels, reading order, actions, dynamic announcements, and large text on a supported iOS device.
- [ ] TalkBack validates labels, reading order, actions, dynamic announcements, and large text on a supported Android device.
- [ ] Keyboard navigation, focus visibility, zoom, and switch behavior are validated on web.
- [ ] Narrow-screen and maximum-font-size testing proves that actions and lifecycle content are not clipped.

## Performance

- [x] Active shipment and trip queries are bounded to 100 records.
- [x] Matching evaluates bounded active inventory, deduplicates traveler evidence loads, caps results per owned listing, and does not persist recommendations.
- [x] Realtime repository watches return cleanup callbacks and screen effects unsubscribe on account/screen changes.
- [x] Booking details load related shipment, trip, and reviews concurrently and keep custody/timeline data subscription-driven.
- [x] Derived match, booking-request, and custody collections use memoization where repeated computation is meaningful.
- [ ] Android and iOS startup, matching refresh, large owned lists, booking details, and memory/listener behavior are profiled on representative devices.
- [ ] Pagination/server-side narrowing is designed before active inventory or participant history can exceed current MVP bounds.

## Manual Testing

### Authentication

- [x] Web app launch renders the welcome route and accessible primary action.
- [x] Email form enables Continue only after input and routes to the documented anonymous bridge.
- [ ] Anonymous session start succeeds in the configured beta Firebase project. The July 2 validation project returned `auth/admin-restricted-operation`; enable the documented anonymous provider or replace the bridge before testing can continue.
- [ ] Session restore returns an existing authenticated user directly to Home after a reload/relaunch.
- [ ] Sign out returns to Welcome and protected tabs return to signed-out empty states.
- [ ] Session resume is verified after background/foreground and process restart on Android and iOS.

### Sender journey

- [ ] Create a shipment and verify the owner-scoped saved card.
- [ ] Open/inspect shipment details and recommended traveler matches.
- [ ] Confirm match score, reasons, eligibility, and freshness text.
- [ ] Request a booking as the shipment owner and verify the traveler receives one in-app notification.
- [ ] Follow booking, custody, shipment timeline, and activity feed through delivery.
- [ ] Complete the delivered booking as the sender and verify final status/history.

### Traveler journey

- [ ] Create a trip and verify the owner-scoped saved card.
- [ ] Inspect recommended shipments and explainable factors.
- [ ] Accept a pending request as the traveler.
- [ ] Record pickup, departure, arrival, and delivery in the allowed order.
- [ ] Verify the sender completes the delivered booking and both participants see canonical state.

### Notifications and identity

- [ ] Save Push/category/quiet-hour preferences; verify Email/SMS remain disabled placeholders.
- [ ] On a native development build, exercise explicit push registration without displaying/logging/persisting a token; delivery remains deferred.
- [ ] Mark an unread notification read and verify recipient-only state plus activity-feed reconciliation.
- [ ] Verify current-user trust summary, verification status, checklist, badge, and timeline.
- [ ] Verify another user exposes reviews-only trust evidence and no private identity, account-age, cancellation, profile, or notification data.

### Offline and recovery

- [ ] Web: validate IndexedDB-backed cached reads, queued writes, reconnect, retry banner, and rejected-write rollback.
- [ ] Android/iOS: validate in-process cached reads and queued writes while the app remains open.
- [ ] Confirm native queued writes/cache do not survive force-close and that copy never claims durable native persistence.
- [ ] Validate listener recovery, stale-state conflict messaging, and account-change cache exposure.

## Known MVP Limitations

- Anonymous Firebase bridge: email delivery and verified account recovery are not implemented; anonymous sign-in must be enabled per beta environment.
- Identity verification placeholder: metadata and state-machine UI exist, but there is no evidence upload, KYC provider, reviewer console, or retention workflow.
- Explainable trust MVP: scores are client-calculated, limited-evidence decision support, not safety, identity, authorization, or delivery guarantees.
- Push registration readiness: explicit native permission/token acquisition exists for development readiness, but trusted token persistence, listeners, delivery, receipts, and server enforcement are deferred.
- No payments.
- No disputes.
- No logistics partners or carrier integrations.
- No production telemetry, crash monitoring, or approved redaction pipeline.
- No App Check enforcement.
- Native Firestore caching is memory-only and does not survive process termination.
- Multi-party booking/custody writes remain client-orchestrated rather than trusted idempotent server commands.
- No automated mobile unit/component runner or Firestore authorization test suite.

## Current Decision

The source is a controlled internal beta candidate, but it is **not ready for external beta testing**. External beta remains blocked until anonymous authentication works in the intended beta project (or the bridge is replaced), Firestore allow/deny coverage and cross-account authorization tests pass, and the Android/iOS accessibility, offline/reconnect, lifecycle, privacy, and operational checklists above are completed on an exact build candidate.

## Related Documents

- [Mobile Architecture](mobile-architecture.md)
- [Security Review](security-review.md)
- [Release Hardening](release-hardening.md)
- [Offline Strategy](../architecture/offline-strategy.md)
- [Booking Lifecycle](../product/booking-lifecycle.md)
- [Discovery Experience](../product/discovery-experience.md)
