# Controlled Push Notification Testing

## Scope

This is a development-only test foundation. Local notification-response routing already exists, but registration occurs only through explicit Profile registration. Repository unregistration occurs only when an explicit caller invokes `remove`. N2 does not connect removal to logout, startup, preference disabling, permission revocation, or another lifecycle trigger.

The following items are future/unimplemented and separated from current N2 manual testing:
- server-side deactivation lifecycle
- invalid-provider-token cleanup
- leases
- retention purging
- provider-response cleanup
- remote delivery

Phase 13 can request permission and obtain an Expo token only after an authenticated user:

1. enables and saves the Push preference; and
2. presses **Enable device notifications** in Profile.

The token repository wiring (implemented in N2) persists the token securely using the trusted backend callables (`registerPushToken`/`unregisterPushToken`). The token is never displayed or logged on the client. End-to-end sending remains blocked until approved server-side development registration tooling exists.

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
- [ ] Verify toggling the preference alone never requests permission or token registration.

## Controlled delivery test checklist for a later phase

No send is authorized by this milestone. Once approved development-only server registration and sender tooling exist:

- [ ] Enroll one named tester installation through the authenticated development endpoint.
- [ ] Resolve its token only in trusted tooling; never copy it from app logs or UI.
- [ ] Require a single-recipient confirmation showing environment, tester, action, and notification ID.
- [ ] Send only the generic title/body approved in the delivery design and one typed payload above.
- [ ] Send one payload at a time; no topics, bulk arrays, domain-event automation, or production project.
- [ ] Record provider ticket/receipt outcome without storing the token or message body in logs.
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

Current N2 foundation:

- Registration occurs only through explicit Profile registration.
- Repository unregistration occurs only when an explicit caller invokes `remove`.
- N2 does not connect removal to logout, startup, preference disabling, permission revocation, or another lifecycle trigger.

Future / unimplemented cleanup:

- Server-side deactivation lifecycle
- Invalid-provider-token cleanup
- Leases
- Retention purging
- Provider-response cleanup
- Remote delivery

## Stop conditions

Stop testing immediately if a token, credential, private notification body, user ID, contact detail, address, evidence URL, package description, or production project appears in a client log, payload example, screenshot, test record, or committed file. Disable the sender, deactivate the token, rotate affected credentials, and complete an incident review before resuming.

