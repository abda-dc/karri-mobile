# Notifications

## Current status

Milestone 4 implements a centralized in-app notification foundation: business services publish typed domain events, `NotificationService` subscribes through the synchronous event bus, and `NotificationRepository` stores recipient records. Templates cover shipment/trip creation, booking outcomes, pickup, delivery, and reviews.

The framework is not started by current UI. Current Firestore rules allow recipients to read notification records but deny every client write, so `FirebaseNotificationRepository` remains a compile-safe adapter for future trusted execution. Firebase Cloud Messaging is still uninitialized.

## Flow

```text
Application service
  -> completed domain event
    -> NotificationService handler
      -> in-app NotificationRepository record
        -> future optional push hint
```

Business services do not directly send notifications.

## Goals

- Tell the right participant that an action completed or needs attention.
- Explain the next action in plain language.
- Avoid leaking package, route, identity, or contact details on a lock screen.
- Remain useful when push is delayed or disabled.

## Current triggers

- Shipment or trip created.
- Booking requested, accepted, declined, cancelled, or expired.
- Package picked up or delivered.
- Review submitted.

## Production direction

Durable Cloud Function handlers consume validated server events, use deterministic effect IDs, apply preferences/templates, create in-app records, and optionally send minimal FCM hints. Push is not the system of record; opening the app reloads authoritative state.

Quiet hours, localization, preference policy, invalid-token cleanup, retry monitoring, and delivery metrics are required before launch. Push, email, and SMS remain outside Milestone 4.

See [Event Bus](../architecture/event-bus.md), [Event Architecture](../engineering/event-architecture.md), and [Application Services](../architecture/application-services.md).
