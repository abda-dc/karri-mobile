# Notifications

## Current implementation

The singleton mobile service composition starts `NotificationService`. Business services publish completed domain events to the synchronous event bus; the notification handler creates deterministic in-app Firestore records for notification types that have not yet migrated. The Profile tab watches the current recipient's records and supports marking unread records as read. `booking.accepted` is the first server-owned notification: a trusted Firestore update trigger validates the authoritative `pending` to `accepted` booking transition and creates the sender's canonical record.

Implemented mappings:

| Event | Recipient |
| --- | --- |
| `booking.requested` | Traveler |
| `booking.accepted` | Sender (trusted N3A backend trigger) |
| `booking.declined` | Sender |
| `booking.cancelled` | Other participant (currently traveler) |
| `package.picked_up` | Sender |
| `package.delivered` | Sender |
| `shipment.completed` | Traveler |
| `review.submitted` | Reviewee |

Operational wording treats `package.picked_up` as the existing custody-transfer and in-transit update. Phase 2 adds the completion mapping through the same in-app event/template pipeline. No new push, email, SMS, or provider delivery path is introduced. Recipient-scoped booking notifications also appear in the Tracking Activity Feed.

Booking expiration has a template but no current client command. Shipment/trip creation events do not generate notifications.

## Integrity and privacy

- Business services never call notification repositories directly.
- Deterministic effect IDs avoid duplicate records for the same event/entity/recipient.
- Firestore rules validate actor, recipient, event type, related booking/review, and current authoritative state.
- Only the recipient may read or mark a notification read.
- Notification text carries no package description, contact information, or evidence URL.

## Current limitations

The local bus remains synchronous and non-durable for notification types other than `booking.accepted`. N3A/N3B do not add a general durable event system, retries, receipt polling, queues, scheduled delivery, monitoring dashboards, localization, or background workers.

N3A implements one immediate, kill-switched Expo provider attempt for a valid `booking.accepted` transition, while N3B binds each selected device attempt to a server-owned registration generation. The service validates the complete persisted notification-preference schema and suppresses partial, malformed, mismatched, or unknown-key records before token lookup. It deterministically examines at most 100 device registration records for the recipient, selects only active bound Expo registrations with a valid positive `registrationVersion`, claims no more than 100 delivery effects, and sends at most 100 messages in one Expo request. Each effect stores the selected generation but never the raw token. Registrations beyond the bound are ignored. Response-body timeout/abort and network failures are temporary outcomes, while malformed JSON is a permanent outcome; neither outcome is retried. This cap is a safety and resource boundary, not a production-scale broadcast design. Broader device-retention policy, pagination, receipt reconciliation, cleanup, and multi-batch fan-out remain deferred. N3A/N3B are not production-enabled or production-ready. Email and SMS remain unimplemented.

## Push notification foundation

Phase 6 adds provider-neutral contracts without enabling push behavior:

- `PushNotificationService` can translate an existing persisted in-app notification identity plus a `NotificationAction` into a minimal delivery request for an injected gateway. Canonical title/body text is deliberately excluded from the request.
- `PushRegistrationService` coordinates a token-registration gateway and token repository without knowing Firebase, Expo, FCM, or APNs APIs.
- `NotificationRouter` resolves semantic actions such as opening a booking or the notification list into provider-neutral destinations, and `notificationRouteAdapter` maps those destinations to current Expo Router paths without navigating.
- The client delivery gateway remains deferred and cannot send. Token persistence instead uses the trusted N1 callables, while N3A provider delivery exists only behind the server trigger and default-off kill switch.
- `usePushNotificationFoundation` exposes availability and semantic action/payload resolution without navigation.

Phase 13 installs and configures `expo-notifications` behind `ExpoPushTokenRegistrationGateway`. The Profile tab shows a separate **Enable device notifications** control only after preferences load. Registration requires an authenticated user, a saved Push preference, an Android/iOS build, a configured EAS project ID, and an explicit button press. The adapter creates the two reviewed Android channels, reads the complete iOS permission state, requests permission only from that button, obtains an Expo token, and immediately disables Expo's automatic token-update mode.

The token then passes through `PushRegistrationService`, which validates ownership and token shape before calling the repository port. N1/N2 persist it through authenticated trusted callables into a server-only registration collection. N3B maintains a server-owned positive `registrationVersion`: the first registration starts at `1`, the same active token preserves it, token replacement or inactive reactivation increments it, and a missing legacy field upgrades to `1`. Malformed or exhausted version state fails closed without changing the stored registration. Clients neither provide nor receive this field. The token is not displayed, logged, returned by the callables, or written directly to Firestore by the client. Denial does not trigger another prompt or open system Settings.

N4A adds an explicit **Unregister this device** Profile action for the current installation. It validates the authenticated user and retained installation ID locally, then sends exactly `{deviceId}` to the trusted N1 endpoint; backend authentication remains the source of ownership. Removal does not need, read, retrieve, store, return, or log the raw token. Missing local installation state is an idempotent successful no-op, malformed or unreadable state defers safely, and successful removal retains the installation ID so later explicit registration can reuse the same device document and N3B generation behavior. The action does not require the Push preference or permission, request permission, create channels, obtain a token, or sign the user out.

For N3A/N3B, the trusted booking update itself is the event boundary, and creation of its deterministic canonical notification is the event-level dispatch claim. Only the invocation that creates the record may evaluate the kill switch, preferences, quiet hours, or registration state and continue into optional push. A matching duplicate returns `event_replay` without reevaluation, so quiet-hours, preference, kill-switch, and no-token suppression are terminal even when state later changes. The creating invocation derives the sender recipient and traveler actor from the booking, selects active bound Expo registrations with valid generations from the first 100 document-ID-ordered records, captures each selected `registrationVersion` in a deterministic per-device effect, and makes at most one immediate provider request of no more than 100 messages. Raw token values never enter the effect. It does not read a second page or queue overflow registrations. A crash after canonical creation but before device claiming can lose the optional push; this is an accepted at-most-one-attempt tradeoff because the in-app notification remains canonical. No retry, queue, delayed delivery, receipt reconciliation, or historical catch-up is added.

Trusted token registration is implemented in N1, N3B adds generation maintenance and cleanup safety, and N4A adds only manual current-installation removal. An immediate Expo `DeviceNotRegistered` result deactivates a registration only when the transaction still sees the same active token and `registrationVersion` selected for that send; a newer generation remains active. Automatic native token-change detection, logout cleanup, startup/foreground reconciliation, permission-revocation cleanup, preference-disable cleanup, receipt polling, scheduled cleanup, retention, and broader lifecycle management remain deferred. Token values are sensitive operational data and must never enter domain events, notification/delivery records, analytics, or logs.

Future notification payloads will carry a small action discriminator and canonical notification identifier only. Firebase-shaped payload parsing stays in Infrastructure; `NotificationRouter` returns a semantic destination; the presentation adapter maps that destination to Expo Router. The current adapter carries a booking identifier separately from its path so a future tap handler can authorize access before selecting a booking. Screens will never parse FCM/APNs payloads directly.

The N3A/N3B provider path is disabled unless the server-only `KARRI_PUSH_DELIVERY_ENABLED` value is exactly `true`. Registration-generation binding does not authorize sending. Production enablement and deployment remain deferred until native credentials, real-device validation, App Check rollout, receipt handling, broader token lifecycle management, diagnostics, and operational approval are complete.

## Notification preference foundation

Phase 7 adds a separate, provider-neutral `NotificationPreferences` aggregate. It contains:

- Category switches for booking updates, booking requests, custody updates, delivery updates, review reminders, trust/profile alerts, and general announcements.
- Channel switches for push, email, and SMS. Every channel defaults off; Email and SMS are modeled placeholders and domain rules reject attempts to enable them.
- Optional quiet hours with distinct local start/end times in `HH:mm` format and an explicit time zone. Overnight windows such as `22:00` to `07:00` are valid.

Category defaults describe which subjects a user may choose to receive; they do not grant permission or activate delivery. N3A requires the exact complete stored schema, including all supported boolean channels/categories, matching ownership, Firestore timestamps, and null or exact-shape quiet hours; it also requires `channels.push` and `categories.booking_updates` to be exactly `true` and email/SMS to be false. Missing, partial, malformed, mismatched, or extended preferences suppress push, and a valid quiet-hours window suppresses the optional attempt permanently for that event while preserving the canonical notification. The backend does not create or repair preference records.

`NotificationPreferenceService` owns read/default/save, channel enable/disable, and quiet-hours orchestration. The repository port is domain-owned. `FirebaseNotificationPreferenceRepository` stores one self-scoped `notificationPreferences/{userId}` document, with rules requiring Email/SMS to remain false. The Profile tab consumes `useNotificationPreferences` and renders the preference card. Saves are bound to the active user, and quiet-hours values must use a runtime-supported IANA time zone.

Saving preferences does not call delivery or registration services. The separate Phase 13 button checks the already-saved Push preference before it can request permission. No listener, navigation, or FCM/APNs delivery starts. Future server work must enforce these preferences rather than inferring consent from category defaults or platform permission.

The reviewed native activation gates and trusted server flow are defined in [Notification Activation and Delivery Design](../architecture/notification-delivery.md). See [Controlled Push Notification Testing](../engineering/push-notification-testing.md) for schema-v1 payload examples and the manual test procedure, and [Production Push Readiness](../operations/push-production-readiness.md) for the final no-go checklist. See also [Event Bus](../architecture/event-bus.md) and [Event Architecture](../engineering/event-architecture.md).
