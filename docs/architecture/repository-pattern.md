# Repository Pattern

## Purpose

Define the persistence boundary between portable business code and Firebase/Firestore.

## Scope

This document covers repository interfaces, Firebase implementations, mappers, current authorization limits, and migration from existing direct helpers.

## Current implementation

Repository interfaces live beside their domain models for users, profiles, shipments, trips, bookings, custody, notifications, reviews, and trust. They depend only on domain types.

Firebase implementations live under `apps/mobile/src/infrastructure/firebase/repositories`, and Firestore conversion lives under `infrastructure/firebase/mappers`. The required implementations are present for User, Profile, Shipment, Trip, Booking, Notification, Review, and Trust; an additional Custody implementation preserves the append/read-only contract.

Firebase adapters now power realtime shipment/trip, participant booking, custody, review, and notification flows. Firestore rules permit only documented actor/state operations and keep custody/review destructive writes and trust-score persistence denied. Production sensitive commands remain a Cloud Functions responsibility.

## Design principles

- Interfaces express business persistence needs, not Firestore operations.
- Mappers are the only place provider timestamps and field-name differences enter domain models.
- Repositories do not decide booking transitions, review eligibility, or trust points.
- Custody exposes append and read, never update or delete.
- Application services coordinate repositories and publish events after successful persistence.
- Security rules and trusted functions remain authoritative even when a repository method exists.

## Future direction

Implement repository ports on the trusted backend through validated callable-command adapters, preserving the current service contracts. Add emulator integration tests for every allowed and denied rule path before deployment.

## Out of scope

- A generic base repository or ORM-style abstraction.
- Broadening participant-scoped collections beyond the documented rules.
- Hiding network failures or treating adapters as authorization.
- Treating the current rules as a substitute for production command transactions.

## Related documents

- [Domain Model](domain-model.md)
- [Application Services](application-services.md)
- [Technical Architecture](technical-architecture.md)
- [Database Design](../engineering/database-design.md)
- [API Design](../engineering/api-design.md)
