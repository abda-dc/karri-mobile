# Architecture Overview

## Purpose

Provide the entry point and source-of-truth map for Karri Mobile architecture.

## Scope

This overview describes dependency direction, implementation status, and where detailed decisions live. It applies only to the fresh `karri-mobile` repository.

## Current implementation

The authoritative backend is Firebase/Firestore. Milestone 5 composes the Milestone 4 layers into the current mobile flow:

```text
Presentation
  -> Application services
    -> Domain models, rules, events, and repository interfaces
      <- Firebase repository implementations and Firestore mappers
        -> Firestore
```

Domain and application code remains portable TypeScript. Firebase-specific classes are isolated under `apps/mobile/src/infrastructure/firebase`. Home, Send, Travel, Tracking, and Profile call application services or presentation components/hooks. Firestore rules permit only participant-scoped, state-guarded booking/custody/review/notification operations; authoritative trust-score persistence remains denied.

## Design principles

- The domain owns business rules; infrastructure persists outcomes.
- UI code does not become an authorization boundary.
- Firebase stays outside the domain and application layers.
- Custody history is append-only.
- Booking state only moves through documented forward transitions.
- Trust is simple, versioned, explainable, and calculated from eligible evidence.
- Documentation distinguishes current behavior from future direction.

## Future direction

Add pure-domain and Emulator Suite tests, then move sensitive commands and durable event effects into Cloud Functions with transactions and idempotency. Add Remote Config, push channels, and offline hardening only after platform behavior is verified.

## Out of scope

- The old Karri monorepo and its deployment assumptions.
- A second backend platform.
- Features listed as Milestone 4 non-goals.
- Claims that the current client/rules boundary is production-hardened.

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
