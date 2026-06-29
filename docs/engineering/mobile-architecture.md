# Mobile Architecture

## Stack

- Expo React Native and TypeScript.
- Expo Router for file-based navigation.
- Firebase modular JavaScript SDK.
- React state and Firebase listeners in the current UI; Zustand is not installed.
- Plain TypeScript domain and application foundations.
- Shared visual tokens and small presentational components.

## Source layout

```text
apps/mobile/
  app/                         Expo Router screens and layouts
  src/
    application/
      dto/                     Presentation-to-service command shapes
      services/                Validation and orchestration
    components/                Reusable mobile UI primitives
    domain/
      booking/                 Booking model, repository port, state machine
      configuration/           Typed operational configuration
      custody/                 Immutable custody model and append/read port
      events/                  Domain events and synchronous event bus
      notification/            In-app notification model and port
      profile/ user/           Account models and ports
      review/ trust/           Review and explainable trust foundations
      shipment/ trip/          Listing models and ports
    infrastructure/firebase/
      mappers/                 Firestore-to-domain conversion
      repositories/            Firebase repository skeletons
    presentation/hooks/        React-facing Auth session bridge
    presentation/stores/       Future thin feature stores if coordination warrants them
    theme/                     Design tokens
    types/                     Provider-independent compatibility aliases and inputs
```

## Dependency direction

Presentation should call application services. Services depend on domain models and repository interfaces. Firebase implementations point inward to those interfaces. Domain and application code do not import Firestore.

The existing shipment/trip screens still call the narrow infrastructure Firestore helper. This preserves the working slice while the service seam is tested; it is an explicit migration state, not the final architecture.

## State approach

- Auth state is observed with the existing Firebase hook.
- Firestore records arrive through `onSnapshot` subscriptions.
- Screens own loading, error, records, and short-lived form state.
- Matching remains derived locally.
- Business rules introduced in Milestone 4 live in services/domain, not stores.

Zustand was evaluated and deferred. Add small feature stores only when multiple routes coordinate client-owned service state beyond Firebase listeners. Avoid one global store and keep Auth, Booking, Shipment, Trip, Notification, and Settings state separate if adopted.

## Quality rules

- Keep Firebase imports out of domain/application code.
- Detach subscriptions and event handlers.
- Distinguish pending local state from server confirmation.
- Expose disabled/loading/error states in plain language.
- Test on devices; TypeScript and Expo Doctor cannot prove runtime behavior.

See [Application Services](../architecture/application-services.md), [Offline Strategy](../architecture/offline-strategy.md), and [Technical Architecture](../architecture/technical-architecture.md).
