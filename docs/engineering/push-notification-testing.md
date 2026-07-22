# Controlled Push Notification Testing

## Scope

This remains a development-only test foundation. Local notification-response routing exists, registration occurs only through explicit Profile registration, N3A adds trusted delivery only for a validated `bookings/{bookingId}` `pending` to `accepted` transition, and N3B binds each delivery effect to a server-owned registration generation. Repository unregistration occurs only when an explicit caller invokes `remove`. No automatic logout, startup, preference-disable, permission-revocation, or token-change lifecycle is present.

The following items remain future/unimplemented:
- server-side deactivation lifecycle
- leases
- retention purging
- receipt polling and provider-receipt cleanup
- automatic retries, queues, scheduled delivery, and background workers
- monitoring dashboards
- production enablement and deployment
- broader device-retention policy, registration pagination, cleanup, and multi-batch fan-out

Phase 13 can request permission and obtain an Expo token only after an authenticated user:

1. enables and saves the Push preference; and
2. presses **Enable device notifications** in Profile.

The token repository wiring (implemented in N2) persists the token securely using the trusted backend callables (`registerPushToken`/`unregisterPushToken`). The token is never displayed or logged on the client. N3B adds a server-owned positive integer `registrationVersion`: a new registration starts at `1`, the same active token preserves it, token replacement or inactive reactivation increments it, a legacy record without the field upgrades to `1`, and malformed or exhausted state fails closed without overwriting the registration. Creation of the deterministic canonical notification is N3A's event-level dispatch claim; only its creating invocation evaluates optional delivery. A matching duplicate returns `event_replay` before reading the kill switch, preferences, quiet hours, or registrations, making first-invocation suppression terminal even if runtime state later changes. Before token lookup, that creating invocation validates the complete persisted notification-preference schema. N3A/N3B order the recipient's registration documents by document ID, examine at most 100 records, and select only active, bound Expo registrations with a valid generation. Each claimed delivery effect records that generation but never the raw token. Immediate `DeviceNotRegistered` cleanup re-reads the registration transactionally and cannot deactivate a newer token generation. The service claims no more than 100 delivery effects and sends at most 100 messages in one Expo request. A crash after canonical creation but before a device claim can lose the optional push; this accepted at-most-one-attempt tradeoff preserves the canonical in-app record. Broader retention policy, pagination, cleanup, receipt polling, and multi-batch fan-out remain deferred. Provider response-body timeout/abort and network-stream failures produce safe temporary outcomes, while invalid or structurally malformed JSON produces a permanent malformed-response outcome. N3A/N3B add no retry, queue, delayed delivery, receipt reconciliation, or catch-up behavior. Provider sending remains disabled by default behind `KARRI_PUSH_DELIVERY_ENABLED`; it is not production-ready.

## Minimal payload contract

`NotificationPushPayload` is provider-neutral and has an exact allowlist:

| Field | Requirement |
| --- | --- |
| `schemaVersion` | Must equal `1` |
| `notificationId` | Required opaque identifier; letters, digits, `.`, `_`, `:`, and `-` only; maximum 128 characters |
| `action` | One of the five allowlisted semantic actions |
| `bookingId` | Required for `open_booking`, optional for `open_tracking`, forbidden otherwise |

Any other key fails validation. This rejects title/body overrides, package descriptions, contact details, phone/email fields, addresses, route/corridor data, evidence URLs, names, prices, user IDs, token values, free-form text, and arbitrary navigation URLs.

## Typed examples

The source of truth is `notificationPushPayloadExamples` in `NotificationPushPayload.ts`.

### `open_home`

```json
{
  "schemaVersion": 1,
  "notificationId": "notification_test_home_001",
  "action": "open_home"
}
```

### `open_profile`

```json
{
  "schemaVersion": 1,
  "notificationId": "notification_test_profile_001",
  "action": "open_profile"
}
```

### `open_notifications`

```json
{
  "schemaVersion": 1,
  "notificationId": "notification_test_list_001",
  "action": "open_notifications"
}
```

### `open_tracking`

```json
{
  "schemaVersion": 1,
  "notificationId": "notification_test_tracking_001",
  "action": "open_tracking"
}
```

### `open_booking`

```json
{
  "schemaVersion": 1,
  "notificationId": "notification_test_booking_001",
  "action": "open_booking",
  "bookingId": "booking_test_001"
}
```

## Expected validation and route outcomes

| Input | Validation | Semantic route | Expo Router target |
| --- | --- | --- | --- |
| `open_home` example | Pass | Home | `/(tabs)/home` |
| `open_profile` example | Pass | Profile | `/(tabs)/profile` |
| `open_notifications` example | Pass | Profile, where the list currently lives | `/(tabs)/profile` |
| `open_tracking` example | Pass | Tracking without selected booking | `/(tabs)/tracking` |
| `open_booking` with safe `bookingId` | Pass | Tracking with booking selection hint | `/(tabs)/tracking` plus separate `bookingId` |
| Missing/wrong `schemaVersion` | Fail | `null` | None |
| Missing/unsafe `notificationId` | Fail | `null` | None |
| `open_booking` without `bookingId` | Fail | `null` | None |
| `open_home` with `bookingId` | Fail | `null` | None |
| Unknown action | Fail | `null` | None |
| Any extra key such as `body`, `packageDescription`, `contactInfo`, `address`, `evidenceUrl`, `url`, `userId`, or `token` | Fail | `null` | None |

## Verify resolution without navigation

Use the validator and existing services in a unit test, debugger evaluation, or temporary local development inspection. Do not call `router.push`:

```ts
const example = notificationPushPayloadExamples.openBooking;
const validation = validateNotificationPushPayload(example);
const route = mobileServices.notificationRouter.resolvePayload(example);
const target = route ? toNotificationRouteTarget(route) : null;
```

Expected:

- `validation.valid === true`;
- `route` resolves to Tracking with `booking_test_001`;
- `target.href === "/(tabs)/tracking"`;
- evaluating this code causes no navigation, permission prompt, listener registration, token request, or network send.

For invalid payloads, `validateNotificationPushPayload` returns explicit errors and `resolvePayload` returns `null`.

## Controlled manual registration checklist

- [ ] Use a development/preview Firebase project and EAS project, never production.
- [ ] Use an Android/iOS development build; do not treat Expo Go on Android as a push test environment.
- [ ] Confirm the build has matching application ID, EAS project ID, FCM/APNs development credentials, and the `expo-notifications` plugin.
- [ ] Confirm Push preference defaults off and no permission prompt appears at app launch, sign-in, Profile load, or preference save.
- [ ] Enable Push and save preferences.
- [ ] Read the on-screen explanation, then explicitly press **Enable device notifications**.
- [ ] Verify Android creates `karri_activity_v1` and `karri_announcements_v1` before the OS prompt.
- [ ] Verify allow, deny, provisional/ephemeral where applicable, and already-denied behavior.
- [ ] Verify no raw token appears in the UI, console, application logs, Firestore, analytics, or error reporting.
- [ ] Verify that the UI reports server registration is confirmed after successful registration.
- [ ] Verify clients neither provide nor receive `registrationVersion`; inspect it only with trusted development tooling.
- [ ] Verify first registration creates version `1`, exact active-token registration preserves it, token replacement increments it, inactive reactivation increments it, and a missing legacy value upgrades safely.
- [ ] Verify malformed or exhausted registration versions fail closed without changing the stored token or generation.
- [ ] Verify toggling the preference alone never requests permission or token registration.

## Controlled N3A delivery test checklist

Only an approved, isolated development environment may enable the server kill switch. N3A has no client-callable sender:

- [ ] Enroll one named tester installation through the authenticated development endpoint.
- [ ] Resolve its token only in trusted tooling; never copy it from app logs or UI.
- [ ] Trigger only a valid test booking transition from `pending` to `accepted`; never introduce a delivery callable or accept client recipient/content input.
- [ ] Verify the canonical notification exists even when push is disabled, suppressed, or fails.
- [ ] Send only **Karri update** / **Open Karri to view your latest activity.** with `{schemaVersion: 1, notificationId, action: "open_notifications"}` and Android channel `karri_activity_v1`.
- [ ] Verify one deterministic server-only delivery effect per selected device, containing the selected positive `registrationVersion` but no token or private message content.
- [ ] Verify registrations with missing, zero, negative, non-integer, or unsafe generations are not selected for delivery; a legacy record becomes eligible only after authenticated registration upgrades it.
- [ ] With more than 100 deterministic fake registration records, verify N3A/N3B inspect/select, claim, and send no more than 100; verify a replay sends nothing again.
- [ ] Verify the Expo provider rejects a direct 101-message batch without a network request and returns only safe `permanent_failure` / `batch_limit_exceeded` outcomes.
- [ ] Verify complete stored preference records may pass policy, while partial, malformed, mismatched, or unknown-key records suppress push and retain the canonical notification.
- [ ] Verify response-body timeout/abort and network failures are temporary, malformed JSON is permanent, and none of these N3A outcomes triggers a retry.
- [ ] Verify quiet-hours, preference, kill-switch, and no-token suppression remain terminal when a duplicate event arrives after those conditions change; each replay must return `event_replay` without a provider call or device effect.
- [ ] Verify a successful creating invocation sends once and creates one deterministic device effect, while its replay sends nothing and leaves one canonical notification and one effect.
- [ ] Record immediate provider ticket outcome without logging the request or raw response.
- [ ] For `DeviceNotRegistered`, verify cleanup removes the token only when both the token and captured `registrationVersion` still match; rotate the registration during the provider call and verify the newer generation remains active.
- [ ] Confirm provider acceptance is not reported as user/device receipt.
- [ ] Confirm the app does not navigate automatically. If a future tap observer is tested, it must authenticate and authorize the canonical record first.
- [ ] Test each valid payload and every failure row in the expected-outcomes table.

## Emulator and real-device matrix

| Target | Registration expectation | Delivery confidence |
| --- | --- | --- |
| Web | Unsupported; control remains unavailable | Not a native push target |
| Expo Go on Android | Not accepted for remote push verification | None |
| Android emulator with Google Play services and development build | May register with matching development credentials | Useful for permission/channel/payload smoke tests |
| Android emulator without Google Play services | Registration should defer/fail safely | None |
| Real Android development device | Required before production go/no-go | Validate foreground/background/terminated and OS channel controls |
| Supported iOS Simulator with development build | Useful smoke coverage where APNs simulator support is available | Supplementary only |
| Registered real iPhone | Required before production go/no-go | Validate all iOS authorization states and foreground/background/terminated behavior |

## Disable and remove test registrations

Current N2/N3B foundation:

- Registration occurs only through explicit Profile registration.
- Repository unregistration occurs only when an explicit caller invokes `remove`.
- The server maintains `registrationVersion` transactionally for explicit registration, token replacement, and inactive reactivation.
- Immediate Expo `DeviceNotRegistered` cleanup is generation-safe and preserves a newer registration.
- No automatic lifecycle trigger connects removal or reconciliation to logout, startup, foreground, preference disabling, permission revocation, or native token-change events.

Future / unimplemented cleanup:

- Broader server-side deactivation lifecycle
- Automatic token-change detection and startup/foreground reconciliation
- Leases
- Retention purging
- Receipt polling and generation-checked receipt cleanup
- Delivery for events other than `booking.accepted`

## Stop conditions

Stop testing immediately if a token, credential, private notification body, user ID, contact detail, address, evidence URL, package description, or production project appears in a client log, payload example, screenshot, test record, or committed file. Disable the sender, deactivate the token, rotate affected credentials, and complete an incident review before resuming.
