# System Architecture

## Scope

Karri Mobile consists of one Expo application, portable domain/application layers, Firebase repositories/mappers, participant-scoped Firestore rules/indexes, and a MkDocs handbook. There is no separate application server, ORM, or deployed Cloud Function in this repository.

## Runtime components

```mermaid
flowchart LR
    User[Sender or traveler] --> Mobile[Expo app]
    Mobile --> Services[Application services]
    Services --> Domain[Domain rules and events]
    Services --> Ports[Repository ports]
    Adapters[Firebase adapters] --> Ports
    Adapters --> Data
    Adapters --> Auth[Firebase Auth]
    Adapters -. initialized, unused .-> Files[Cloud Storage]

    Data -. planned trusted commands .-> Functions[Cloud Functions]
    Functions -. planned .-> Push[FCM]
```

## Current data flows

1. Firebase configuration is read from `EXPO_PUBLIC_FIREBASE_*` variables.
2. The MVP verification action starts or reuses an anonymous Firebase Auth session.
3. Shipment and trip screens require that authenticated session.
4. Current helpers attach the UID, active status, and server timestamps.
5. Realtime listeners return owner-scoped or active-market records.
6. Home computes exact corridor matches locally.

Milestone 5 uses a singleton mobile composition to connect screens, services, the event bus, and Firebase adapters.

## Failure and trust boundaries

- Missing configuration prevents Firebase initialization with a readable setup message.
- Missing Auth prevents ownerless data writes.
- Firestore rules remain the final direct-client access boundary.
- Firestore rules constrain every client lifecycle operation; application types alone do not authorize it.
- Domain validation improves consistency but cannot authorize an untrusted device.
- Cloud Functions will validate and transact multi-party commands.

## Future trusted flow

A mobile command calls a versioned Cloud Function. The function authenticates the actor, validates current state and idempotency, transacts records, appends a durable event, and lets idempotent handlers materialize in-app notifications. The client re-reads authoritative state.

See [Technical Architecture](../architecture/technical-architecture.md), [Repository Pattern](../architecture/repository-pattern.md), and [API Design](api-design.md).
