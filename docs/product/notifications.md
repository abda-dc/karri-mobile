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

Push, email, and SMS are not implemented.

## Push notification foundation

Phase 6 adds provider-neutral contracts without enabling push behavior:

- `PushNotificationService` can translate an existing persisted in-app notification identity plus a `NotificationAction` into a minimal delivery request for an injected gateway. Canonical title/body text is deliberately excluded from the request.
- `PushRegistrationService` coordinates a token-registration gateway and token repository without knowing Firebase, Expo, FCM, or APNs APIs.
- `NotificationRouter` resolves semantic actions such as opening a booking or the notification list into provider-neutral destinations, and `notificationRouteAdapter` maps those destinations to current Expo Router paths without navigating.
- Firebase infrastructure stubs report `deferred`; they do not request a token, write a token, contact FCM/APNs, or send a notification.
- `usePushNotificationFoundation` exposes only availability and semantic action resolution. It has no permission prompt, listener, registration effect, or navigation side effect.

The intended future flow is: a trusted transaction records a durable domain event, an idempotent server consumer materializes the in-app notification, and a separate push projection sends a minimal hint referring to that record. Push will not replace the in-app notification as the canonical user-visible record.

Token registration will begin only after explicit user intent and approved permission copy. A future runtime adapter will obtain a platform token, associate it with the authenticated user and app installation, and pass it through `PushRegistrationService` to an authenticated trusted registration endpoint. The server, not the client, will own token persistence. Rotation, sign-out removal, invalid-token cleanup, per-device state, and retention rules must be implemented before enabling registration. Token values are sensitive operational data and must never enter domain events, analytics, or logs.

Future notification payloads will carry a small action discriminator and canonical notification identifier only. Firebase-shaped payload parsing stays in Infrastructure; `NotificationRouter` returns a semantic destination; the presentation adapter maps that destination to Expo Router. The current adapter carries a booking identifier separately from its path so a future tap handler can authorize access before selecting a booking. Screens will never parse FCM/APNs payloads directly.

Delivery is intentionally deferred until Karri has permission UX, native credentials/build configuration, trusted server execution, preferences and quiet hours, payload privacy review, deep-link authorization, token lifecycle handling, retries, and delivery diagnostics.

## Notification preference foundation

Phase 7 adds a separate, provider-neutral `NotificationPreferences` aggregate. It contains:

- Category switches for booking updates, booking requests, custody updates, delivery updates, review reminders, trust/profile alerts, and general announcements.
- Channel switches for push, email, and SMS. Every channel defaults off; Email and SMS are modeled placeholders and domain rules reject attempts to enable them.
- Optional quiet hours with distinct local start/end times in `HH:mm` format and an explicit time zone. Overnight windows such as `22:00` to `07:00` are valid.

Category defaults describe which subjects a user may choose to receive; they do not grant permission or activate delivery. A future delivery decision must require the relevant category and channel to be enabled, respect quiet hours, and still pass platform permission and server policy checks.

`NotificationPreferenceService` owns read/default/save, channel enable/disable, and quiet-hours orchestration. The repository port is domain-owned. `FirebaseNotificationPreferenceRepository` stores one self-scoped `notificationPreferences/{userId}` document, with rules requiring Email/SMS to remain false. The Profile tab consumes `useNotificationPreferences` and renders the preference card. Saves are bound to the active user, and quiet-hours values must use a runtime-supported IANA time zone.

The preference foundation does not call the Phase 6 delivery or registration services. It does not request notification permission, register a token, start a listener, navigate, or contact FCM/APNs. Future push work must explicitly connect these preferences to trusted delivery rather than inferring consent from a stored category default.

The reviewed native activation gates and trusted server flow are defined in [Notification Activation and Delivery Design](../architecture/notification-delivery.md). See also [Event Bus](../architecture/event-bus.md) and [Event Architecture](../engineering/event-architecture.md).
