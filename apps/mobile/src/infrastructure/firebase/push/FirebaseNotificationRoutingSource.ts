import {
  NotificationActionType,
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
      case NotificationActionType.OpenBooking:
        return typeof payload.bookingId === "string" && payload.bookingId.trim()
          ? {
              bookingId: payload.bookingId.trim(),
              type: NotificationActionType.OpenBooking,
            }
          : null;
      case NotificationActionType.OpenNotifications:
        return { type: NotificationActionType.OpenNotifications };
      case NotificationActionType.OpenHome:
        return { type: NotificationActionType.OpenHome };
      default:
        return null;
    }
  }
}
