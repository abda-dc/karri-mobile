# Mobile Architecture

## Stack

- Expo React Native, Expo Router, Expo Network, React, and strict TypeScript.
- Firebase modular SDK isolated under `src/infrastructure/firebase`.
- Portable domain models/rules and application services.
- React screen state and realtime repository watches; Zustand remains uninstalled.
- Expo Notifications is installed behind an Infrastructure adapter. Permission/token acquisition is available only through an explicit Profile control; listeners, automatic navigation, token persistence, and delivery remain absent.

## Source layout

```text
apps/mobile/
  app/                              Expo Router screens
  src/
    application/dto/                Service command shapes
    application/errors/             Provider-neutral error model and logging ports
    application/notifications/      Push token and semantic action models
    application/services/           Validation and orchestration
    domain/                          Models, preference rules, events, repository ports
    infrastructure/firebase/
      FirebaseOfflineStatusGateway.ts  One network listener and pending-write tracking
      firestoreCache(.native).ts       Platform-specific cache configuration
      mappers/                       Firestore/domain conversion
      push/                          Deferred delivery/persistence plus validated payload routing
      repositories/                  Realtime Firebase adapters
    infrastructure/expo/notifications/  Explicit native permission/token adapter
    infrastructure/logging/          Replaceable diagnostics adapter
    presentation/
      components/                    Reusable booking, shipment, custody, timeline, activity, identity, and trust views
      errors/                        Provider-neutral user messages
      hooks/                         Auth/offline bridges plus push/preference foundations
      services/                      Singleton mobile service composition
```

## Current screen-to-service flow

- Home watches active listings through `ShipmentService`/`TripService` and calls `BookingService.request`.
- Send and Travel create/watch owner listings through services and call the composed `MatchingService` for grouped per-listing recommendations. Screen state owns filter forms/loading/errors; scores, eligibility, reasons, sorting, and result caps stay in application/domain code.
- Tracking uses one combined `BookingService` subscription for participant bookings and requests plus one recipient-scoped `NotificationService` subscription. `BookingDetailCard` composes shipment/trip/review data, sender-safe shipment timeline or traveler-safe booking custody watches, self-readable identity state, visible trust evidence, and authorized booking/custody/review commands.
- Profile watches bookings and in-app notifications and requests trust summaries.
- The shared `Screen` shell consumes `useOfflineStatus` and displays offline, queued, syncing, or failed-write state without provider imports.
- Presentation reports caught failures through `ApplicationErrorService`; screens receive safe category-specific messages while Firebase codes and original exceptions remain diagnostic-only.
- `PushNotificationService` remains composed with a deferred Firebase delivery gateway. `PushRegistrationService` uses `ExpoPushTokenRegistrationGateway` plus a deferred trusted-persistence port. Profile invokes it only from the experimental button after checking saved preferences. No runtime listener, automatic navigation, or delivery starts.
- `NotificationPreferenceService` uses a self-scoped repository to load defaults or store immutable preference snapshots. The Profile screen consumes `useNotificationPreferences`; saving preferences still does not activate push or request platform permission.
- No prioritized Milestone 5 screen imports the legacy Firestore helper; that helper was removed.

Screens decide presentation and available controls, while services and domain guards repeat every business rule. Firebase repositories and security rules remain the persistence/access boundary.

## State approach

Realtime Firestore snapshots feed small screen-local arrays. Tracking's combined activity watch owns one cleanup callback that stops its booking and booking-request listeners together. Form, loading, error, and pending-action state stays local. A singleton offline gateway tracks Firestore write acknowledgements and owns the only network listener; `OfflineService` fans status out to presentation hooks. No global store is justified yet.

## Quality and limitations

- Domain/application code remains Firebase-free.
- Service and repository watches return explicit unsubscribe callbacks.
- Expo web uses IndexedDB-backed Firestore persistence; native Expo uses an honest memory-only queue that does not survive process termination.
- Booking status, shipment timeline, custody summary, and Activity Feed distinguish stored facts from planned actions. The feed is a presentation projection, not a persistence model.
- Discovery cards render `MatchResult` as returned, including freshness. Cached/unknown labels are presentation of `MatchingService` data, not a new offline cache or persistence claim.
- Mobile business operations and asynchronous notification effects are not one atomic server transaction.
- Registration availability is `available` only in Android/iOS builds with an EAS project ID. An explicit action may request/acquire a token, but trusted persistence remains deferred; tokens are not displayed/logged and semantic routes are resolved without execution.
- Preference persistence does not activate a channel. Push defaults off, Email/SMS are enforced placeholders, and quiet hours are stored but not evaluated by any delivery runtime.
- Device testing and Firebase Emulator Suite authorization tests remain necessary.

## Release-hardening boundary

Expo SDK package ranges are patch-aligned and verified with `expo-doctor`. Reusable buttons, badges, and status chips expose screen-reader labels/roles and non-color status text. Screens use shared loading, empty, banner, and offline patterns, and caught failures pass through `reportFriendlyError`.

Marketplace/tab screens do not import Firebase or Firestore. The `index`, `login`, and `verify` bootstrap routes still call Firebase configuration/auth Infrastructure adapters directly; they are documented compatibility exceptions and should migrate behind composition rather than becoming a precedent for new screens.

See [Release Hardening](release-hardening.md), [Security Review](security-review.md), [Application Services](../architecture/application-services.md), [Notification Delivery](../architecture/notification-delivery.md), [Error Handling](../architecture/error-handling.md), [Offline Strategy](../architecture/offline-strategy.md), and [Technical Architecture](../architecture/technical-architecture.md).
