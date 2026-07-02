# Activity Feed

## Purpose

The Tracking Activity Feed gives participants one plain-language view of operational history without creating another lifecycle or persistence model.

## Sources

`ActivityFeed` combines presentation projections from existing application/domain records:

| Source | Feed use |
| --- | --- |
| Booking status history | Request, acceptance, transit, delivery, completion, and terminal outcomes |
| Shipment timeline | Shipment creation and travel movement from canonical custody events |
| Custody | Responsibility, pickup, handoff, delivery, and completion events |
| Identity verification | The signed-in participant's self-readable verification changes |
| Trust summary | The other participant's scope-limited visible score refresh |
| In-app notifications | Recipient-owned booking updates from the existing notification service |

Events are sorted newest first. Each row contains an icon marker, short title, simple explanation, timestamp, and actor when the source safely identifies one. The shipment timeline separately stays oldest first because it explains journey progression.

## Privacy and authority

- The feed reads through application services; presentation does not import Firebase.
- Another participant's private identity record is never queried or inferred.
- Trust text uses only the evidence scope returned by `TrustService`.
- Notification rows are recipient-scoped and filtered to the current booking.
- The feed does not authorize actions, change status, or persist a duplicate activity collection.
- Shipment and custody rows share the canonical `CustodyEvent` record and are classified for readability rather than copied.

## Notification-ready milestones

The existing in-app notification foundation covers booking accepted, shipment picked up/custody transferred/in transit, shipment delivered, and shipment completed. Notification materialization remains asynchronous and client-orchestrated in this MVP. Push delivery is still deferred.

## Out of scope

Payments, disputes, GPS, maps, proof of delivery, photo upload, admin dashboards, carrier integrations, and new push delivery infrastructure are not part of the feed.
