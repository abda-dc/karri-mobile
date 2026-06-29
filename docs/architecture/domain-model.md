# Domain Model

## Purpose

Define the portable business vocabulary introduced in Milestone 4 and its relationship to compatibility types used by existing screens.

## Scope

The model covers users, profiles, shipments, trips, bookings, booking requests, custody events, notifications, reviews, trust scores, configuration, and domain events.

## Current implementation

Plain TypeScript models live under `apps/mobile/src/domain` and import no Firebase, Firestore, React, Expo, Zustand, or AsyncStorage code.

| Aggregate or value | Key responsibility |
| --- | --- |
| `User`, `Profile` | Account and marketplace-role data used by repository contracts |
| `Shipment` | Sender-owned package listing and corridor request |
| `Trip` | Traveler-owned route and capacity listing |
| `BookingRequest` | The sender's proposal to a traveler |
| `Booking` | The authoritative finite lifecycle from pending through a terminal state |
| `CustodyEvent` | Immutable fact appended to a booking's custody history |
| `Notification` | Recipient-owned in-app notification record |
| `Review` | One participant's rating of the other after a completed booking |
| `TrustScore` | Versioned result plus factor-by-factor explanations |
| `AppConfig` | Typed non-secret operational configuration and safe defaults |
| `DomainEvent` | A completed in-process business fact |

Domain timestamps are ISO strings or `null`; Firestore `Timestamp` conversion belongs to infrastructure mappers. `src/types/models.ts` now exposes provider-independent compatibility aliases and input shapes for existing screens while services are adopted.

## Design principles

- Models use business names and readonly fields where mutation would be misleading.
- IDs are opaque strings, not provider-specific references.
- Time and persistence formats cross the boundary through mappers.
- A domain model does not grant access or prove that a workflow is deployed.
- New records and persisted records have separate types where repository-assigned IDs or timestamps differ.

## Future direction

Move screens from compatibility aliases to service DTOs as flows adopt application services. Add pure unit tests and refine value objects only when concrete validation or localization needs justify them. Server command contracts should reuse the same vocabulary without importing mobile infrastructure.

## Out of scope

- ORM entities, Firestore converters, React hooks, and screen state.
- Payment, dispute, chat, or matching-ranking models.
- Legal or safety guarantees inferred from a TypeScript type.

## Related documents

- [Repository Pattern](repository-pattern.md)
- [Application Services](application-services.md)
- [Booking State Machine](booking-state-machine.md)
- [Custody Model](custody-model.md)
- [Database Design](../engineering/database-design.md)
