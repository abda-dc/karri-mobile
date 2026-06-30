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
| `PushNotificationService` | Convert a canonical in-app notification identity and semantic action into a content-free provider-neutral delivery request; current gateway returns deferred |
| `PushRegistrationService` | Expose provider-neutral permission status, validate explicit per-user/install token registration, and coordinate trusted persistence; Expo acquisition is active only from the user control while persistence remains deferred |
| `NotificationRouter` | Parse injected provider payloads into semantic actions and resolve provider-neutral destinations. Presentation adapts those destinations into Expo Router paths without embedding navigation inside the service layer |
| `NotificationPreferenceService` | Load safe defaults, persist preference snapshots, enable/disable available channels, and validate quiet hours through domain helpers |
| `ReviewService` | Enforce completed-booking participation, one review per reviewer, rating bounds, and aggregate averages |
| `TrustService` | Validate evidence inputs, invoke the versioned calculator, persist the result |
| `OfflineService` | Expose provider-neutral connectivity/pending-write status and safely retry Firestore's existing queue |
| `RemoteConfigService` | Serve safe typed defaults and optionally refresh from a provider |
| `ApplicationErrorService` | Normalize domain/provider failures, attach recovery guidance, and report structured diagnostics through an injected logger |

Services import repository interfaces and domain types; they do not import Firestore. A singleton presentation composition now injects Firebase adapters and the event bus. Home, Send, Travel, Tracking, and Profile use the service layer.

Push delivery remains inert: no domain-event handler calls `PushNotificationService`. Registration is separately user-initiated from Profile through `PushRegistrationService` and an Expo Infrastructure adapter. It can request permission/acquire a token in a configured native build, but trusted persistence returns deferred and no sender exists. The real delivery gateway must run in trusted server code.

Preference reads and writes use the domain-owned `NotificationPreferenceRepository` port. The Firebase adapter may store a self-scoped preference document, but neither the service nor repository starts delivery. Email and SMS remain disabled placeholders, and stored push preference is not platform permission.

## Design principles

- Presentation supplies intent; services validate and orchestrate it.
- Domain helpers own reusable rules such as booking transition legality and trust factor calculation.
- Persistence succeeds before a completed event is published.
- Infrastructure maps and stores; it does not decide business outcomes.
- Time is injected through a small `Clock` contract for deterministic tests.
- Trusted server execution remains mandatory for multi-party authority.

## Future direction

Keep the service contracts while moving sensitive persistence behind callable Cloud Functions with transactions, idempotency, and durable events. The notification activation and delivery boundary is specified in [Notification Delivery](notification-delivery.md). Add unit tests with in-memory repositories and Emulator Suite integration coverage.

Zustand remains deferred. Screens use thin local state and service-backed realtime watches. Add small feature stores only when multiple routes genuinely coordinate the same client-owned pending state; stores must not absorb domain rules.

## Out of scope

- UI rewrites or new routes.
- Direct Firestore access from services.
- A giant global store or speculative store scaffolding.
- Cloud Function deployment in this milestone.
- Automatic permission prompts, notification listeners/navigation, trusted token storage, or FCM/APNs delivery.
- A separate Settings route or delivery-time preference enforcement runtime.

## Related documents

- [Domain Model](domain-model.md)
- [Repository Pattern](repository-pattern.md)
- [Error Handling](error-handling.md)
- [Event Bus](event-bus.md)
- [Notification Delivery](notification-delivery.md)
- [Mobile Architecture](../engineering/mobile-architecture.md)
- [API Design](../engineering/api-design.md)
