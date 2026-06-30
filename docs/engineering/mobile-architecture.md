# Mobile Architecture

## Stack

- Expo React Native, Expo Router, Expo Network, React, and strict TypeScript.
- Firebase modular SDK isolated under `src/infrastructure/firebase`.
- Portable domain models/rules and application services.
- React screen state and realtime repository watches; Zustand remains uninstalled.

## Source layout

```text
apps/mobile/
  app/                              Expo Router screens
  src/
    application/dto/                Service command shapes
    application/errors/             Provider-neutral error model and logging ports
    application/services/           Validation and orchestration
    domain/                          Models, state guards, events, repository ports
    infrastructure/firebase/
      FirebaseOfflineStatusGateway.ts  One network listener and pending-write tracking
      firestoreCache(.native).ts       Platform-specific cache configuration
      mappers/                       Firestore/domain conversion
      repositories/                  Realtime Firebase adapters
    infrastructure/logging/          Replaceable diagnostics adapter
    presentation/
      components/                    Booking and trust composed views
      errors/                        Provider-neutral user messages
      hooks/                         Auth session bridge
      services/                      Singleton mobile service composition
```

## Current screen-to-service flow

- Home watches active listings through `ShipmentService`/`TripService` and calls `BookingService.request`.
- Send and Travel create and watch owner listings through services.
- Tracking uses one combined `BookingService` subscription for participant bookings and booking requests, composes shipment/trip/custody/review detail, and calls booking/custody/review services.
- Profile watches bookings and in-app notifications and requests trust summaries.
- The shared `Screen` shell consumes `useOfflineStatus` and displays offline, queued, syncing, or failed-write state without provider imports.
- Presentation reports caught failures through `ApplicationErrorService`; screens receive safe category-specific messages while Firebase codes and original exceptions remain diagnostic-only.
- No prioritized Milestone 5 screen imports the legacy Firestore helper; that helper was removed.

Screens decide presentation and available controls, while services and domain guards repeat every business rule. Firebase repositories and security rules remain the persistence/access boundary.

## State approach

Realtime Firestore snapshots feed small screen-local arrays. Tracking's combined activity watch owns one cleanup callback that stops its booking and booking-request listeners together. Form, loading, error, and pending-action state stays local. A singleton offline gateway tracks Firestore write acknowledgements and owns the only network listener; `OfflineService` fans status out to presentation hooks. No global store is justified yet.

## Quality and limitations

- Domain/application code remains Firebase-free.
- Service and repository watches return explicit unsubscribe callbacks.
- Expo web uses IndexedDB-backed Firestore persistence; native Expo uses an honest memory-only queue that does not survive process termination.
- Booking status and custody timelines distinguish stored facts from planned actions.
- Mobile business operations and asynchronous notification effects are not one atomic server transaction.
- Device testing and Firebase Emulator Suite authorization tests remain necessary.

See [Application Services](../architecture/application-services.md), [Error Handling](../architecture/error-handling.md), [Offline Strategy](../architecture/offline-strategy.md), and [Technical Architecture](../architecture/technical-architecture.md).
