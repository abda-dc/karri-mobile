# Repository Pattern

## Purpose

Define the persistence boundary between portable business code and Firebase/Firestore.

## Scope

This document covers repository interfaces, Firebase implementations, mappers, current authorization limits, and migration from existing direct helpers.

## Current implementation

Repository interfaces live beside their domain models for users, profiles, shipments, trips, bookings, custody, notifications, reviews, and trust. They depend only on domain types.

Firebase implementations live under `apps/mobile/src/infrastructure/firebase/repositories`, and Firestore conversion lives under `infrastructure/firebase/mappers`. The required implementations are present for User, Profile, Shipment, Trip, Booking, Notification, Review, and Trust; an additional Custody implementation preserves the append/read-only contract.

The adapters are compile-safe skeletons. Shipment and trip methods align with currently permitted Firestore operations. Booking, custody, review, notification mutation, and trust-score methods are not wired to the UI and will be rejected by current rules. Production sensitive commands remain a Cloud Functions responsibility.

## Design principles

- Interfaces express business persistence needs, not Firestore operations.
- Mappers are the only place provider timestamps and field-name differences enter domain models.
- Repositories do not decide booking transitions, review eligibility, or trust points.
- Custody exposes append and read, never update or delete.
- Application services coordinate repositories and publish events after successful persistence.
- Security rules and trusted functions remain authoritative even when a repository method exists.

## Future direction

Inject Firebase repositories into migrated shipment and trip services first. For sensitive flows, implement repository ports on the trusted backend or through validated callable-command adapters rather than enabling unrestricted client writes. Add emulator integration tests for every allowed and denied path.

## Out of scope

- A generic base repository or ORM-style abstraction.
- Enabling currently denied collections.
- Hiding network failures or treating adapters as authorization.
- Migrating existing screens in this milestone.

## Related documents

- [Domain Model](domain-model.md)
- [Application Services](application-services.md)
- [Technical Architecture](technical-architecture.md)
- [Database Design](../engineering/database-design.md)
- [API Design](../engineering/api-design.md)
