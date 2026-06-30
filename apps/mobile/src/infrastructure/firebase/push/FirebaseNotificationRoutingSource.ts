import {
  NotificationActionType,
  normalizeNotificationActionEntityId,
  type NotificationAction,
} from "../../../application/notifications/NotificationAction";
import type { NotificationRoutingSource } from "../../../application/services/NotificationRouter";

function isPayload(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class FirebaseNotificationRoutingSource implements NotificationRoutingSource {
  parseAction(payload: unknown): NotificationAction | null {
    if (!isPayload(payload) || typeof payload.action !== "string") {
      return null;
    }

    switch (payload.action) {
      case NotificationActionType.OpenBooking: {
        const bookingId = normalizeNotificationActionEntityId(payload.bookingId);
        return bookingId
          ? {
              bookingId,
              type: NotificationActionType.OpenBooking,
            }
          : null;
      }
      case NotificationActionType.OpenTracking:
        return {
          bookingId:
            normalizeNotificationActionEntityId(payload.bookingId) ?? undefined,
          type: NotificationActionType.OpenTracking,
        };
      case NotificationActionType.OpenNotifications:
        return { type: NotificationActionType.OpenNotifications };
      case NotificationActionType.OpenProfile:
        return { type: NotificationActionType.OpenProfile };
      case NotificationActionType.OpenHome:
        return { type: NotificationActionType.OpenHome };
      default:
        return null;
    }
  }
}
