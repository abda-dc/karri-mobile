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

The local bus is synchronous and non-durable, while Firestore creation is asynchronous. A failed notification does not roll back the business transition. Durable server events, idempotent Cloud Function consumers, retries, failed-effect monitoring, localization, quiet hours, and preferences remain future work.

Push, email, and SMS are not implemented.

See [Event Bus](../architecture/event-bus.md) and [Event Architecture](../engineering/event-architecture.md).
