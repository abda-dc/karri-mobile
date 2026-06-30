# Application Services

## Purpose

Define the orchestration layer between presentation, portable domain rules, repository contracts, and domain events.

## Scope

This document covers the implemented service foundations for shipments, trips, bookings, in-app and future push notifications, notification preferences, reviews, trust, offline status, and typed remote configuration.

## Current implementation

| Service | Current responsibility |
| --- | --- |
| `ShipmentService` | Validate and normalize a listing, persist it, publish `ShipmentCreated` |
| `TripService` | Validate route/date/capacity data, persist it, publish `TripCreated` |
| `BookingService` | Create requests, enforce actor roles and forward transitions, coordinate request/booking persistence, publish lifecycle events |
| `NotificationService` | Subscribe to domain events and materialize in-app notification records |
| `PushNotificationService` | Convert a canonical in-app notification and semantic action into a provider-neutral delivery request; current gateway returns deferred |
| `PushRegistrationService` | Coordinate future per-user/device token registration and persistence; current adapters return deferred without prompting |
| `NotificationRouter` | Parse injected provider payloads into semantic actions and resolve provider-neutral destinations without navigating |
| `NotificationPreferenceService` | Load safe defaults, persist preference snapshots, enable/disable available channels, and validate quiet hours through domain helpers |
| `ReviewService` | Enforce completed-booking participation, one review per reviewer, rating bounds, and aggregate averages |
| `TrustService` | Validate evidence inputs, invoke the versioned calculator, persist the result |
| `OfflineService` | Expose provider-neutral connectivity/pending-write status and safely retry Firestore's existing queue |
| `RemoteConfigService` | Serve safe typed defaults and optionally refresh from a provider |
| `ApplicationErrorService` | Normalize domain/provider failures, attach recovery guidance, and report structured diagnostics through an injected logger |

Services import repository interfaces and domain types; they do not import Firestore. A singleton presentation composition now injects Firebase adapters and the event bus. Home, Send, Travel, Tracking, and Profile use the service layer.

Push services are composed but inert. No current domain-event handler calls `PushNotificationService`, and no presentation route calls registration. This keeps in-app notification behavior unchanged while fixing the future provider seams.

Preference reads and writes use the domain-owned `NotificationPreferenceRepository` port. The Firebase adapter may store a self-scoped preference document, but neither the service nor repository starts delivery. Email and SMS remain disabled placeholders, and stored push preference is not platform permission.

## Design principles

- Presentation supplies intent; services validate and orchestrate it.
- Domain helpers own reusable rules such as booking transition legality and trust factor calculation.
- Persistence succeeds before a completed event is published.
- Infrastructure maps and stores; it does not decide business outcomes.
- Time is injected through a small `Clock` contract for deterministic tests.
- Trusted server execution remains mandatory for multi-party authority.

## Future direction

Keep the service contracts while moving sensitive persistence behind callable Cloud Functions with transactions, idempotency, and durable events. Add unit tests with in-memory repositories and Emulator Suite integration coverage.

Zustand remains deferred. Screens use thin local state and service-backed realtime watches. Add small feature stores only when multiple routes genuinely coordinate the same client-owned pending state; stores must not absorb domain rules.

## Out of scope

- UI rewrites or new routes.
- Direct Firestore access from services.
- A giant global store or speculative store scaffolding.
- Cloud Function deployment in this milestone.
- Notification permission prompts, Expo Notifications runtime behavior, token storage, or FCM/APNs delivery.
- Notification preference screens, Settings navigation, or delivery-time preference enforcement.

## Related documents

- [Domain Model](domain-model.md)
- [Repository Pattern](repository-pattern.md)
- [Error Handling](error-handling.md)
- [Event Bus](event-bus.md)
- [Mobile Architecture](../engineering/mobile-architecture.md)
- [API Design](../engineering/api-design.md)
