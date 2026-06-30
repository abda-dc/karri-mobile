# Error Handling

## Purpose

Define one provider-neutral error contract for application behavior, safe user messages, recovery guidance, and future diagnostics.

## Current implementation

`ApplicationError` is the application model for failures. It records a stable application code, safe user message, retry guidance, retryability, an optional provider code, and the original error. The original error is retained for diagnostics and is never rendered by a screen.

`ApplicationErrorService` applies mappings in this order:

1. Preserve an existing `ApplicationError`.
2. Preserve safe domain validation and booking-transition messages.
3. Ask injected infrastructure mappers to translate provider failures.
4. Fall back to a safe unknown-error message that advises checking current activity before another mutation.

The Firebase mapper stays under `src/infrastructure/firebase`. It recognizes Firebase Auth and Firestore codes without leaking provider objects into application or screen state. Presentation composes that mapper with a console logger and exposes two helpers:

- `getFriendlyError` performs pure normalization for already-reported state, such as the shared offline banner.
- `reportFriendlyError` records operation context and returns the same safe message for an error banner.

Background notification persistence, initial network-state checks, reconnect synchronization, and manual sync retry failures use the same reporting hook even when no screen owns the operation.

## User-safe categories

| Category | User behavior | Recovery guidance |
| --- | --- | --- |
| Validation or domain rule | Preserve the specific rule failure. | Correct the input, or refresh and use an allowed lifecycle action. |
| Offline or unavailable | Explain that the service cannot currently be reached. | Check connectivity; existing queued writes resume through Firestore after reconnect. |
| Permission or expired session | Explain that the account cannot perform the action. | Sign in with the correct account; do not blindly replay the mutation. |
| Conflict or stale state | Explain that state changed or the action is no longer available. | Review the latest realtime state before retrying. |
| Timeout or temporary service failure | Explain that confirmation is incomplete. | Check sync state before repeating an action. |
| Unknown | Use a neutral Karri message. | Check current activity and sync state before deciding whether to retry. |

Raw Firebase codes, exception messages, and stack details must not be interpolated into banners, labels, or form errors.

## Logging strategy

`ApplicationErrorLogger` is an application-owned interface. The current infrastructure adapter writes structured operation name, application code, provider code, retryability, surface, and allowlisted metadata to the development console together with the original error. There is no external logging vendor.

Future telemetry may replace the console adapter at composition time. Before doing so, define redaction and consent rules; do not send form values, package details, identity data, or arbitrary exception payloads to a vendor.

## Offline and optimistic behavior

Error mapping does not replay commands or own pending UI state. Screen-local optimistic projections still roll back in their existing `catch` paths. Firestore remains responsible for accepted queued writes, and realtime subscriptions remain canonical after reconnect.

Unknown, permission, validation, and conflict failures are not marked safe for automatic retry. Network and timeout failures may be retryable, but lifecycle and custody UI must still check refreshed authoritative state before issuing another command.

## Follow-up

- Add table-driven mapper tests when the mobile project adopts a test runner.
- Add Firebase Emulator Suite coverage for denied writes, stale transitions, and listener failures.
- Replace the console adapter only after diagnostics redaction and production consent requirements are defined.

## Related documents

- [Application Services](application-services.md)
- [Offline Strategy](offline-strategy.md)
- [Mobile Architecture](../engineering/mobile-architecture.md)
- [UX Patterns](../design/ux-patterns.md)
