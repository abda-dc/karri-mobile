# Architecture Overview

## Purpose

Provide the entry point and source-of-truth map for Karri Mobile architecture.

## Scope

This overview describes dependency direction, implementation status, and where detailed decisions live. It applies only to the fresh `karri-mobile` repository.

## Current implementation

The authoritative backend is Firebase/Firestore. The implemented mobile listing slice still calls focused Firebase helpers from presentation code. Milestone 4 introduces the layered foundation that later flows will adopt:

```text
Presentation
  -> Application services
    -> Domain models, rules, events, and repository interfaces
      <- Firebase repository implementations and Firestore mappers
        -> Firestore
```

The new domain and application code is portable TypeScript. Firebase-specific classes are isolated under `apps/mobile/src/infrastructure/firebase`. Trust-sensitive collections remain denied to the mobile client, so compile-safe adapters do not make unfinished flows operational.

## Design principles

- The domain owns business rules; infrastructure persists outcomes.
- UI code does not become an authorization boundary.
- Firebase stays outside the domain and application layers.
- Custody history is append-only.
- Booking state only moves through documented forward transitions.
- Trust is simple, versioned, explainable, and calculated from eligible evidence.
- Documentation distinguishes current behavior from future direction.

## Future direction

Migrate current shipment and trip flows behind services, add pure-domain tests, implement trusted Cloud Function commands, and connect the local contracts to server-validated persistence. Add Remote Config, durable events, notifications, and offline hardening only after their platform-specific behavior is verified.

## Out of scope

- The old Karri monorepo and its deployment assumptions.
- A second backend platform.
- Features listed as Milestone 4 non-goals.
- Claims that unconnected skeletons are production features.

## Related documents

- [Technical Architecture](technical-architecture.md)
- [Platform Services](platform-services.md)
- [Technology Roadmap](technology-roadmap.md)
- [Domain Model](domain-model.md)
- [Repository Pattern](repository-pattern.md)
- [Application Services](application-services.md)
- [Event Bus](event-bus.md)
- [Offline Strategy](offline-strategy.md)
- [Remote Configuration](remote-config.md)
- [Trust Engine](trust-engine.md)
- [Booking State Machine](booking-state-machine.md)
- [Custody Model](custody-model.md)
