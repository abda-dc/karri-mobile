# Notification Activation and Delivery Design

## Status and guardrails

This document covers the controlled client foundation, the implemented trusted persistence backend (N1), and the still-deferred trusted delivery system.

The following functionality is **implemented in N1**:
- Authenticated `registerPushToken` and `unregisterPushToken` Cloud Functions (using us-east1 callables, with request authentication validation and payload verification).
- Server-only deterministic Firestore persistence under `/pushTokenRegistrations/{userId}/devices/{deviceId}`.
- Automated token removal and inactive-record reconciliation under Firestore transaction boundaries (deleting the token value and setting revokedAt to a Firestore Timestamp).

The following functionality is **deferred/future**:
- Mobile `FirebasePushTokenRepository` wiring is deferred to Phase N2.
- The mobile app installs `expo-notifications` but does not persist/display/log the token, start a notification listener, navigate from a notification, or send a push.
- Trusted push-message delivery, notification queues, receipts, retries, monitoring, cleanup, and provider sending are not implemented.

The activation order is deliberate:

1. Keep an in-app notification record as the canonical user-visible fact.
2. Keep native permission/token acquisition behind explicit user intent; do not wire the client repositories (N2) until the persistence callables and rules (N1) are validated.
3. Add trusted server delivery only after preference enforcement, idempotency, token privacy, retries, and monitoring exist.
4. Roll out push as an optional hint. Never make it the only record of a booking, custody, delivery, review, or trust event.

## Reviewed architecture boundary

| Layer | Current responsibility | Hard boundary |
| --- | --- | --- |
| Domain | Notification records, preference rules, categories, channels, and quiet-hours values | No Firebase, Expo, FCM, APNs, permission, token, or navigation APIs |
| Application | In-app notification orchestration, deferred push/registration contracts, and semantic action routing | No provider imports and no assumption that a stored preference is platform permission |
| Infrastructure | Firestore repositories, deferred Firebase delivery/persistence, validated payload routing, and the explicit Expo native registration adapter | Provider payload parsing stops at a validated semantic action; permission/token acquisition is user-initiated and delivery remains inert |
| Presentation | Profile notification/preference UI, availability hook, Expo Router target adapter, and the composition root that injects infrastructure adapters | Screens/components do not call Firebase; no permission prompt, token effect, listener, or automatic navigation |
| Trusted server (N1 persistence) | Authenticated token registration/unregistration callables, token deletion, and inactive-record reconciliation | Direct client access to the pushTokenRegistrations collection is denied; only us-east1 server callables run Firestore transactions |
| Trusted server delivery (future) | Durable events, canonical notification materialization, policy evaluation, token lookup, provider delivery, receipts, retries, and cleanup | Never expose service credentials or unrestricted token access to a client |

The current `notificationPreferences/{userId}` record stores user intent only. `channels.push == true` does not prove OS authorization, create a token, or authorize delivery. Category defaults also do not opt a user into push because every channel defaults off. The inert `PushNotificationRequest` carries notification/recipient identity and a semantic action, but deliberately excludes canonical title/body content.

The current route chain is:

```text
untrusted provider payload
  -> FirebaseNotificationRoutingSource
  -> NotificationAction
  -> NotificationRouter
  -> NotificationRoute
  -> notificationRouteAdapter
  -> Expo Router target
```

`open_notifications` and `open_profile` currently target the Profile tab because that is where the notification list lives. `open_booking` and `open_tracking` target Tracking and may carry a bounded booking ID separately from the route path. A future tap handler must authenticate the user, load the canonical notification, verify recipient and booking participation, and only then navigate or select a booking. A payload action is a hint, never authorization.

## Native push activation plan

### Package and provider strategy

Phase 13 uses `expo-notifications` as the native client adapter. It can obtain an `ExpoPushToken`, while the future trusted sender is planned to use Expo Push Service first. This is the smallest operational surface while preserving provider-neutral application contracts and the option to move the server gateway to direct FCM/APNs later.

Current controlled foundation:

- The SDK-compatible `expo-notifications` package and config plugin are present; `expo-constants` supplies an EAS project ID when configured.
- Background remote notifications are explicitly disabled in plugin configuration.
- Use a development build or signed EAS build. Expo Go is not an acceptance-test environment for remote push.
- Keep `FirebasePushNotificationGateway` and `FirebasePushTokenRepository` deferred until trusted server endpoints pass the rollout gates below.
- Do not add local notifications, background notification tasks, exact alarms, rich media, or interactive actions in the first activation.

### Android notification channels

Create stable, versioned channels before requesting permission or obtaining a token on Android 13+:

| Channel ID | Intended content | Initial behavior |
| --- | --- | --- |
| `karri_activity_v1` | Booking, custody, delivery, review, and trust/profile updates | Default importance, default sound, no vibration customization |
| `karri_announcements_v1` | General platform announcements | Low importance, no custom sound |

Channel IDs are an OS-visible contract. Do not delete and recreate a channel to override a user's settings. Introduce a new versioned ID only for a reviewed semantic change. Application category preferences and Android channel settings are independent gates; a server must enforce the former, while Android enforces the latter.

### iOS permission copy and timing

Ask only after an authenticated user explicitly selects **Enable device notifications** from the Profile notification settings. Saving category preferences must not trigger the prompt. Show one in-app explanation first:

> **Stay updated on your Karri activity**
>
> Get a brief alert when a booking, custody, delivery, review, or trust update needs your attention. Details stay inside Karri. You can change this anytime.

Offer **Not now** and **Continue**. Call the OS request only after **Continue**. Do not prompt during onboarding, sign-in, app launch, or a booking transition. If authorization is denied, preserve the in-app experience, explain how to use system Settings, and do not repeatedly ask. Treat iOS `authorized`, `provisional`, `ephemeral`, `denied`, and `not determined` as distinct states rather than reducing them to a boolean.

### EAS and native credential prerequisites

Before any runtime code lands:

- Assign the Expo project an EAS `projectId` and stable Android package/iOS bundle identifiers.
- Add reviewed development, preview, and production EAS build profiles with separate Firebase projects.
- Build after every notification config-plugin or native credential change; an over-the-air update cannot add missing native notification capability.
- Register test devices and keep a paid Apple Developer account available for iOS credentials.
- Record credential owners, expiry/revocation steps, and an emergency send-disable procedure.

| Platform | Required material | Storage rule |
| --- | --- | --- |
| Android | Firebase Android app, matching `google-services.json`, enabled FCM HTTP v1 API, and a least-privilege FCM v1 service-account key uploaded to EAS | `google-services.json` is reviewed public project metadata; the service-account JSON is a secret and must never be committed or bundled |
| iOS | Registered bundle ID, push capability, provisioning profile, and APNs authentication key managed through EAS credentials | APNs private key material stays in the credential manager, never in the repository or app bundle |
| Server | Expo Push Service access token if enhanced push security is enabled | Secret manager/runtime environment only; never `EXPO_PUBLIC_*`, Firestore, logs, or mobile configuration |

### Token registration flow

The future client flow is explicit and authenticated:

1. User selects **Enable device notifications**.
2. Presentation reads current OS authorization; if needed, it shows the approved explanation and requests permission once.
3. Android creates the reviewed channels before token acquisition.
4. The native adapter obtains the Expo push token using the configured EAS project ID.
5. The adapter associates it with a random app-installation ID, platform, provider, app version, environment, and current permission state. Do not use a hardware identifier.
6. `PushRegistrationService` validates ownership/token shape and passes it to the token repository port.
7. The mobile repository returns `deferred` (wiring is deferred to N2); the backend has the trusted persistence callable implemented (`registerPushToken`).
8. The server derives `userId` from verified authentication, validates authenticated user ownership, installation device ID, platform, Expo provider, token shape, and canonical registration timestamp, and upserts the installation registration.
9. Only after server confirmation may the UI show the device as registered. Permission granted without confirmed registration is a recoverable incomplete state.

Clients must not write token documents directly. The backend persistence layer is now implemented via authenticated callables (`registerPushToken` and `unregisterPushToken`), but the client-side repository wiring is still deferred until N2. Push delivery is still deferred (No-Go status). No permission or token behavior should be described as production-complete yet. App Check should be staged before broad rollout, but authentication, ownership validation, and server-only token access are enforced.

`PushRegistrationService.unregister` and the Expo adapter provide the current cleanup seam: automatic Expo token updates can be disabled and the repository remove operation is invoked. The repository remains deferred, so this is not yet client-to-server authenticated sign-out cleanup or proof of server deletion.

### Rotation, sign-out, and invalid-token cleanup

- Subscribe to the native token-change signal while the authenticated app is running. Upsert the new token for the same installation and deactivate the old token atomically.
- Reconcile the current token on foreground/startup after permission is granted and refresh the server `lastSeenAt` timestamp. Do not fetch or upload a token when permission is absent or push intent is off.
- On sign-out, call the authenticated unregister endpoint before local session teardown, then continue sign-out even if the network fails. Keep a local cleanup tombstone and retry it on the next authenticated launch; short server registration leases reduce exposure when cleanup cannot reach the server.
- On `DeviceNotRegistered`, FCM `UNREGISTERED`, or an equivalent confirmed permanent response, immediately deactivate the registration. Treat `INVALID_ARGUMENT` as token-invalid only after the payload is independently known to be valid.
- A reinstalled app or changed token creates/reconciles an installation registration; it never silently inherits another user's binding.

### Preferences and quiet hours

Delivery requires all of the following at send time:

- an active, non-expired device registration for the recipient;
- push channel enabled in the latest preference record;
- the versioned event-to-category mapping enabled;
- a valid IANA time zone and a time outside quiet hours, unless a separately approved critical-event policy applies;
- a deliverable canonical notification and an authorized recipient.

Missing, malformed, or unreadable preferences fail closed for push. There is no critical-event exception today. During quiet hours, retain the canonical in-app record and defer only the optional push until the window ends. Re-evaluate preferences, quiet hours, and token state immediately before a deferred send.

### Deep-link authorization

The first payload shape should contain only a schema version, canonical notification ID, and a coarse action such as `open_notifications`. Do not trust a payload-supplied user ID, booking ID, role, status, URL, or route.

On tap, the app must:

1. require an authenticated session;
2. read `notifications/{notificationId}` through the recipient-scoped path;
3. confirm the record belongs to the signed-in user;
4. resolve any related booking/review from canonical data and re-check participant authorization;
5. map the resulting semantic action through `NotificationRouter` and `notificationRouteAdapter`;
6. fall back to the Profile notification list if the record is missing, stale, malformed, or no longer authorized.

### Test checklist

The executable payload contract, typed examples, expected routes/failures, and manual device procedure are maintained in [Controlled Push Notification Testing](../engineering/push-notification-testing.md).

Automated checks before activation:

- Unit tests for permission-state orchestration, token validation/rotation, action parsing, category mapping, quiet-hour boundaries (same-day, overnight, DST, invalid zone), and route fallback.
- Emulator tests proving clients cannot read/write another user's preferences, registrations, delivery effects, or notifications.
- Function tests for duplicate domain events, duplicate worker invocation, preference changes while queued, quiet-hour deferral, invalid tokens, transient provider errors, permanent payload errors, and sign-out cleanup.
- Contract tests proving no raw token or private notification content enters logs, events, IDs, or analytics.

Device matrix before rollout:

- Android emulator with Google Play services plus at least one real Android device; test fresh allow, deny, disabled OS channel, killed app, background, foreground, token rotation/reinstall, and both channel IDs.
- iOS simulator where supported plus at least one registered real iPhone; test `not determined`, allow, deny, provisional if intentionally used, system-settings changes, killed app, background, foreground, and reinstall.
- Development, preview, and production credentials tested only against their matching Firebase/EAS project.
- Tap tests for signed out, wrong user, removed booking access, deleted notification, malformed payload, and valid authorized notification.
- Receipt tests that distinguish provider acceptance from device/user receipt and deactivate confirmed invalid registrations.

### Rollout and rollback

1. Land server data/rules and delivery code with sending disabled.
2. Ship native registration UI behind a remote kill switch to internal development builds.
3. Enable token registration for staff, then preview testers, without enabling sends.
4. Enable one low-volume event category and inspect registration, suppression, receipt, retry, and invalid-token metrics.
5. Expand by category and cohort; keep announcements disabled until separately reviewed.
6. Roll back by disabling server dispatch and client registration independently. In-app records continue working throughout.

## Trusted server-side delivery design

### Delivery flow

```mermaid
flowchart TD
  Event["Durable domain event"] --> Materializer["Trusted notification materializer"]
  Materializer --> Canonical["Canonical in-app notification"]
  Canonical --> Dispatcher["Trusted dispatch worker"]
  Dispatcher --> Policy["Preference and quiet-hours evaluation"]
  Policy --> Registrations["Active device registration lookup"]
  Registrations --> Payload["Minimal privacy-reviewed payload"]
  Payload --> Provider["Expo Push Service, then FCM/APNs"]
  Provider --> Result["Ticket and receipt result"]
  Result --> Delivery["Delivery effect update"]
  Delivery --> Retry["Retry, deactivate, or dead-letter"]
```

Client-side push delivery is not trusted because a modified client could choose another recipient, bypass preferences/quiet hours, expose token values, alter templates, replay sends, or use bundled credentials. Firestore rules cannot safely grant a mobile client provider credentials or cross-user token lookup. The mobile `PushNotificationService` therefore remains an inert contract/composition seam; a real delivery gateway belongs in trusted server code.

The in-app record remains canonical because push is best-effort, may be delayed, may be suppressed by user/OS policy, and may never reach a device. Product UI, unread state, authorization, and audit/support behavior read the canonical record, not a provider receipt.

### Idempotency and effect IDs

Assume at-least-once event and worker execution:

- Give each durable domain event an immutable `eventId` and schema version.
- Derive `notificationEffectId` from a digest of `notification:v1:{eventId}:{recipientId}`. Preserve the existing deterministic notification IDs during migration or map them explicitly; do not silently duplicate current records.
- Derive one `deliveryEffectId` from a digest of `push:v1:{notificationId}:{registrationId}:{projectionVersion}`.
- Never place a raw token, title/body, email, phone number, or unrestricted route in an ID.
- Create/read the notification and delivery effect transactionally. A terminal delivery effect is a no-op on replay; a retryable effect resumes from its persisted attempt state.
- Use `notificationId` as the provider collapse/deduplication hint where supported. Exactly-once device display cannot be promised if a worker crashes after provider acceptance but before persisting the result.

### Proposed data boundaries

These are future collections only. This phase does not create them or broaden current rules.

| Collection | Purpose | Client access |
| --- | --- | --- |
| `domainEvents/{eventId}` | Durable, versioned completed facts written with trusted business transitions | Deny direct mobile read/write unless a later projection has an explicit need |
| `notifications/{notificationEffectId}` | Existing canonical user-visible notification projection | Recipient read and constrained read-state update; future materialization is server-only |
| `pushRegistrations/{registrationId}` | Installation binding, provider, encrypted/protected token value, token hash, permission state, environment, `lastSeenAt`, and active/revoked state | No direct read/write; authenticated server endpoints return only non-secret status |
| `notificationDeliveries/{deliveryEffectId}` | Policy decision, attempt count, next attempt, provider ticket/receipt identifiers, outcome code, and timestamps | No direct mobile access |

Use a terminal `dead_letter` state in `notificationDeliveries` rather than copying private payloads into a separate dead-letter collection. Add indexes and server-only rules only with the future implementation and Emulator Suite tests.

### Policy evaluation

- Maintain one versioned map from domain event type to notification category, template, channel ID, default priority, and maximum delivery age.
- Load preferences after the canonical record exists and again immediately before provider send. Missing/invalid records, push disabled, or category disabled produce a terminal `suppressed_preference` effect without token lookup.
- Interpret quiet hours using the stored IANA zone and DST-aware time APIs. Start is inclusive and end is exclusive; an end earlier than start is an overnight interval.
- Quiet hours produce `deferred_quiet_hours` with `nextAttemptAt` at the next local end. If the event expires before then, suppress the push and retain the in-app record.
- No current category bypasses quiet hours. Any future safety exception requires a product, legal/privacy, and abuse review plus explicit schema versioning.

### Token privacy and retention

- Treat tokens as authentication-adjacent secrets. Restrict them to the registration and dispatch service accounts, redact them from logs/errors/traces, and never copy them into domain events, notification records, delivery IDs, analytics, or support exports.
- Store a keyed hash for equality/deduplication and the recoverable token only where the sender requires it. Use managed encryption at rest and evaluate application-level encryption/KMS before production.
- Scope each registration to one environment, app identifier, provider, installation, and current user binding. Reject cross-project tokens.
- Immediately deactivate on sign-out, permission revocation reported by the client, account deletion, or confirmed permanent provider response.
- Proposed baseline: require a successful registration heartbeat within 30 days; stop sending to stale registrations, remove recoverable token values after 30 additional inactive days, and keep only a non-secret tombstone long enough to prevent replay. Final periods require the data-retention/privacy review.
- Retain successful delivery metadata for 30 days and failure/dead-letter metadata for 90 days unless incident/legal requirements approve a different period. Store outcome codes, not message bodies.

### Delivery results, retry, and cleanup

Use explicit states such as `queued`, `suppressed_preference`, `deferred_quiet_hours`, `sending`, `provider_accepted`, `retry_wait`, `invalid_registration`, `permanent_failure`, and `dead_letter`. Provider acceptance means only that Expo/FCM/APNs accepted the message, not that a user saw it.

- Retry only transient network failures, timeouts, HTTP 429, HTTP 5xx, and provider rate limits.
- Use exponential backoff with full jitter, for example 1, 2, 4, 8, 16, 32, then 60 minutes, capped at eight attempts and the event's 24-hour delivery age.
- Do not blindly retry invalid credentials, malformed/oversized payloads, project/sender mismatch, unauthorized requests, or deterministic policy/schema errors. Mark them permanent and alert.
- Deactivate confirmed unregistered tokens. When using Expo Push Service, persist ticket IDs and reconcile receipts; a successful ticket is not final delivery status.
- Keep retries idempotent. Built-in Cloud Function retry may be used only for transient failures after duplicate invocation has been pressure-tested; quiet-hour scheduling and bounded retry state must be persisted rather than simulated by throwing indefinitely.
- Move exhausted transient failures to `dead_letter`, increment a monitored counter, and provide an operator-safe replay that revalidates preference, quiet hours, token, event age, and idempotency first.

### Payload privacy

The initial visible alert should be generic, for example **Karri update** / **Open Karri to view your latest activity**. Data should contain only `schemaVersion`, `notificationId`, and an allowlisted coarse action. Exclude names, package descriptions, routes/corridors, contact details, prices, trust details, evidence URLs, free-form notes, user IDs, token values, and authoritative booking state.

The app fetches the recipient-scoped canonical record after open. Notification previews on a locked device therefore reveal no transaction detail. Payloads remain below provider limits and are rejected against an allowlisted schema before send and after receipt.

### Future Cloud Function boundaries

Suggested responsibilities, not deployed functions:

- `materializeNotification`: consume a trusted durable event, validate schema, derive recipient/template/effect ID, and create the canonical notification once.
- `dispatchNotification`: react to a new canonical record or queued delivery command, evaluate policy, load active registrations, create delivery effects, and send minimal payloads.
- `reconcilePushReceipts`: collect provider receipts, mark accepted/permanent/retry outcomes, and deactivate invalid registrations.
- `prunePushRegistrations`: expire stale/inactive registrations and enforce token retention.
- `resumeDeferredDeliveries`: select due quiet-hour/retry effects, re-evaluate every gate, and dispatch within rate limits.

Co-locate functions with Firestore where supported, use least-privilege service accounts, validate App Check/authentication on callable registration endpoints, and keep provider secrets in managed secret storage. Materialization failure must alert because it affects the canonical record; push dispatch failure must never roll back or delete that record.

### Monitoring and launch gates

Monitor counts and age by event category and environment: canonical materialization lag/failures, active/stale registrations, preference suppression, quiet-hour deferral, provider acceptance, missing receipts, retry attempts, invalid registrations, permanent failures, and dead letters. Logs use effect IDs and outcome codes only.

Production send remains blocked until:

- rules and Function tests cover allow/deny, duplicate, retry, and cleanup cases;
- credential rotation and emergency send-disable are rehearsed;
- token/payload logging is proven redacted;
- real-device permission, background/terminated delivery, and authorization tests pass;
- dashboards/alerts and an operator runbook exist;
- privacy, retention, copy, and rollout owners approve activation.

The evidence-bearing production decision is tracked in [Production Push Readiness](../operations/push-production-readiness.md). Its current status is No-Go.

## Official implementation references

- [Expo push notification setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo Notifications SDK 56 reference](https://docs.expo.dev/versions/v56.0.0/sdk/notifications/)
- [Expo FCM v1 credential setup](https://docs.expo.dev/push-notifications/fcm-credentials/)
- [Expo Push Service delivery, receipts, and errors](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Firebase registration lifecycle guidance](https://firebase.google.com/docs/cloud-messaging/manage-tokens)
- [Cloud Firestore function triggers](https://firebase.google.com/docs/functions/firestore-events)
- [Cloud Functions retry guidance](https://firebase.google.com/docs/functions/retries)
