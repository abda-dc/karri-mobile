# Karri Platform v2

Karri is a mobile-first peer-to-peer cross-border shipping platform. It helps diaspora senders find travelers already moving along the same corridor, then makes responsibility and package custody visible from request through delivery.

The first market is the East African diaspora. The product is designed to expand corridor by corridor without weakening the local trust, clarity, and reliability that make the first corridors work.

## Product promise

> I know who I am coordinating with, what we agreed to, who has the package, and what happens next.

Karri is guided by four operating values:

- **Trust:** identity, reputation, and custody signals must be understandable.
- **Transparency:** status, expectations, and limitations must be visible.
- **Reliability:** important transitions must be recorded and recoverable.
- **Simplicity:** a first-time sender or traveler should know what to do next.

## Current product slice

The repository contains an Expo Router mobile app, Firebase/Firestore infrastructure, and portable domain/application architecture. The implemented user-facing slice supports shipment/trip creation, exact-corridor matching, booking requests and decisions, status/custody tracking, in-app notifications, explainable trust summaries, and completed-booking reviews.

Firebase Auth and participant-scoped Firestore rules are the current MVP policy boundary. Production Cloud Function commands, durable events, emulator coverage, payments, disputes, chat, push, email, SMS, and AI matching remain out of scope.

## Platform direction

```mermaid
flowchart LR
    S[Sender creates shipment] --> M[Corridor match]
    T[Traveler creates trip] --> M
    M --> R[Booking request]
    R --> A[Accepted booking]
    A --> C[Custody events]
    C --> D[Delivery]
    D --> V[Review and trust update]
```

Start with the [Executive Summary](strategy/executive-summary.md), then use the [Architecture Overview](architecture/README.md), Product, and Engineering sections as the source of truth for implementation decisions.
