# Application Services

## Purpose

Define the orchestration layer between presentation, portable domain rules, repository contracts, and domain events.

## Scope

This document covers the implemented service foundations for shipments, trips, bookings, notifications, reviews, trust, and typed remote configuration.

## Current implementation

| Service | Current responsibility |
| --- | --- |
| `ShipmentService` | Validate and normalize a listing, persist it, publish `ShipmentCreated` |
| `TripService` | Validate route/date/capacity data, persist it, publish `TripCreated` |
| `BookingService` | Create requests, enforce actor roles and forward transitions, coordinate request/booking persistence, publish lifecycle events |
| `NotificationService` | Subscribe to domain events and materialize in-app notification records |
| `ReviewService` | Enforce completed-booking participation, one review per reviewer, rating bounds, and aggregate averages |
| `TrustService` | Validate evidence inputs, invoke the versioned calculator, persist the result |
| `RemoteConfigService` | Serve safe typed defaults and optionally refresh from a provider |

Services import repository interfaces and domain types; they do not import Firestore. Existing screens are not yet wired to them, so the currently visible listing flow remains unchanged.

## Design principles

- Presentation supplies intent; services validate and orchestrate it.
- Domain helpers own reusable rules such as booking transition legality and trust factor calculation.
- Persistence succeeds before a completed event is published.
- Infrastructure maps and stores; it does not decide business outcomes.
- Time is injected through a small `Clock` contract for deterministic tests.
- Trusted server execution remains mandatory for multi-party authority.

## Future direction

Create a composition root that injects repositories and the event bus, then migrate shipment/trip screens one flow at a time. Implement sensitive services behind callable Cloud Functions with transactions and idempotency. Add unit tests with in-memory repositories before connecting new UI.

Zustand remains deferred. The current app uses screen-local state and Firebase listeners, and no cross-screen client-owned state currently justifies another dependency. When services are wired and multiple routes coordinate the same pending data, add small feature stores such as Auth, Booking, Shipment, Trip, Notification, and Settings stores. Stores may cache state and actions but must not absorb domain rules.

## Out of scope

- UI rewrites or new routes.
- Direct Firestore access from services.
- A giant global store or speculative store scaffolding.
- Cloud Function deployment in this milestone.

## Related documents

- [Domain Model](domain-model.md)
- [Repository Pattern](repository-pattern.md)
- [Event Bus](event-bus.md)
- [Mobile Architecture](../engineering/mobile-architecture.md)
- [API Design](../engineering/api-design.md)
