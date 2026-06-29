# Notifications

## Current status

Notifications are not implemented. The data model includes a placeholder notification record, the rules draft permits a recipient to read their own notification, and clients cannot create notifications. Firebase Cloud Messaging is a future integration placeholder only.

## Notification goals

- Tell the right participant that a meaningful action completed or needs attention.
- Explain the next action in plain language.
- Avoid leaking package, route, identity, or contact details on a lock screen.
- Remain useful when push delivery is delayed or disabled.

## Planned triggers

- Booking requested, accepted, declined, cancelled, or expiring.
- Pickup or delivery action required.
- Custody event recorded.
- Journey exception reported.
- Review becomes eligible.
- Security-sensitive account change.

## Delivery design

Cloud Functions consume validated domain events, apply preferences and templates, create an in-app notification, and optionally send a minimal FCM push. Handlers use deterministic effect IDs so retries do not create duplicate notifications.

## Preferences and privacy

Transactional custody and security notices may have different opt-out rules from product updates. Push previews use generic text such as “A booking needs your attention”; authenticated in-app views show authorized detail.

## Reliability

Push is a convenience channel, not the system of record. The app reads authoritative booking/custody state after opening. Delivery metrics, invalid-token cleanup, quiet-hour policy, localization, and retry failure handling are required before launch.
