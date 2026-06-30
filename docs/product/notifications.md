# Notifications

## Current implementation

The singleton mobile service composition starts `NotificationService`. Business services publish completed domain events to the synchronous event bus; the notification handler creates deterministic in-app Firestore records. The Profile tab watches the current recipient's records and supports marking unread records as read.

Implemented mappings:

| Event | Recipient |
| --- | --- |
| `booking.requested` | Traveler |
| `booking.accepted` | Sender |
| `booking.declined` | Sender |
| `booking.cancelled` | Other participant (currently traveler) |
| `package.picked_up` | Sender |
| `package.delivered` | Sender |
| `review.submitted` | Reviewee |

Booking expiration has a template but no current client command. Shipment/trip creation events do not generate notifications.

## Integrity and privacy

- Business services never call notification repositories directly.
- Deterministic effect IDs avoid duplicate records for the same event/entity/recipient.
- Firestore rules validate actor, recipient, event type, related booking/review, and current authoritative state.
- Only the recipient may read or mark a notification read.
- Notification text carries no package description, contact information, or evidence URL.

## Current limitations

The local bus is synchronous and non-durable, while Firestore creation is asynchronous. A failed notification does not roll back the business transition. Durable server events, idempotent Cloud Function consumers, retries, failed-effect monitoring, localization, and preference enforcement remain future work.

Production push delivery, email, and SMS are not implemented. Expo token acquisition is available only through the controlled, user-initiated development foundation described below.

## Push notification foundation

Phase 6 adds provider-neutral contracts without enabling push behavior:

- `PushNotificationService` can translate an existing persisted in-app notification identity plus a `NotificationAction` into a minimal delivery request for an injected gateway. Canonical title/body text is deliberately excluded from the request.
- `PushRegistrationService` coordinates a token-registration gateway and token repository without knowing Firebase, Expo, FCM, or APNs APIs.
- `NotificationRouter` resolves semantic actions such as opening a booking or the notification list into provider-neutral destinations, and `notificationRouteAdapter` maps those destinations to current Expo Router paths without navigating.
- Firebase delivery and token-persistence stubs report `deferred`; they do not write a token, contact FCM/APNs, or send a notification.
- `usePushNotificationFoundation` exposes availability and semantic action/payload resolution without navigation.

Phase 13 installs and configures `expo-notifications` behind `ExpoPushTokenRegistrationGateway`. The Profile tab shows a separate **Enable device notifications** control only after preferences load. Registration requires an authenticated user, a saved Push preference, an Android/iOS build, a configured EAS project ID, and an explicit button press. The adapter creates the two reviewed Android channels, reads the complete iOS permission state, requests permission only from that button, obtains an Expo token, and immediately disables Expo's automatic token-update mode.

The token then passes through `PushRegistrationService`, which validates ownership and token shape before calling the repository port. The current repository intentionally returns `deferred` because no trusted registration endpoint or server token store exists. The token is not displayed, logged, or written directly to Firestore. Denial does not trigger another prompt or open system Settings.

The existing unregister path is a cleanup stub: the Expo adapter disables automatic token updates and `PushRegistrationService` asks the deferred repository to remove the binding. No sign-out UI currently invokes it, and it does not claim server cleanup until the authenticated endpoint exists.

The intended future flow is: a trusted transaction records a durable domain event, an idempotent server consumer materializes the in-app notification, and a separate push projection sends a minimal hint referring to that record. Push will not replace the in-app notification as the canonical user-visible record.

Trusted token registration remains future work. The server, not the client, will own token persistence. Rotation, sign-out removal, invalid-token cleanup, per-device state, and retention rules must be implemented before enabling delivery. Token values are sensitive operational data and must never enter domain events, analytics, or logs.

Future notification payloads will carry a small action discriminator and canonical notification identifier only. Firebase-shaped payload parsing stays in Infrastructure; `NotificationRouter` returns a semantic destination; the presentation adapter maps that destination to Expo Router. The current adapter carries a booking identifier separately from its path so a future tap handler can authorize access before selecting a booking. Screens will never parse FCM/APNs payloads directly.

Delivery is intentionally deferred until Karri has permission UX, native credentials/build configuration, trusted server execution, preferences and quiet hours, payload privacy review, deep-link authorization, token lifecycle handling, retries, and delivery diagnostics.

## Notification preference foundation

Phase 7 adds a separate, provider-neutral `NotificationPreferences` aggregate. It contains:

- Category switches for booking updates, booking requests, custody updates, delivery updates, review reminders, trust/profile alerts, and general announcements.
- Channel switches for push, email, and SMS. Every channel defaults off; Email and SMS are modeled placeholders and domain rules reject attempts to enable them.
- Optional quiet hours with distinct local start/end times in `HH:mm` format and an explicit time zone. Overnight windows such as `22:00` to `07:00` are valid.

Category defaults describe which subjects a user may choose to receive; they do not grant permission or activate delivery. A future delivery decision must require the relevant category and channel to be enabled, respect quiet hours, and still pass platform permission and server policy checks.

`NotificationPreferenceService` owns read/default/save, channel enable/disable, and quiet-hours orchestration. The repository port is domain-owned. `FirebaseNotificationPreferenceRepository` stores one self-scoped `notificationPreferences/{userId}` document, with rules requiring Email/SMS to remain false. The Profile tab consumes `useNotificationPreferences` and renders the preference card. Saves are bound to the active user, and quiet-hours values must use a runtime-supported IANA time zone.

Saving preferences does not call delivery or registration services. The separate Phase 13 button checks the already-saved Push preference before it can request permission. No listener, navigation, or FCM/APNs delivery starts. Future server work must enforce these preferences rather than inferring consent from category defaults or platform permission.

The reviewed native activation gates and trusted server flow are defined in [Notification Activation and Delivery Design](../architecture/notification-delivery.md). See [Controlled Push Notification Testing](../engineering/push-notification-testing.md) for schema-v1 payload examples and the manual test procedure, and [Production Push Readiness](../operations/push-production-readiness.md) for the final no-go checklist. See also [Event Bus](../architecture/event-bus.md) and [Event Architecture](../engineering/event-architecture.md).
