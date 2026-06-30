import {
  NotificationActionType,
  type NotificationAction,
} from "../../../application/notifications/NotificationAction";
import type { NotificationRoutingSource } from "../../../application/services/NotificationRouter";

function isPayload(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOptionalText(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export class FirebaseNotificationRoutingSource implements NotificationRoutingSource {
  parseAction(payload: unknown): NotificationAction | null {
    if (!isPayload(payload) || typeof payload.action !== "string") {
      return null;
    }

    switch (payload.action) {
      case NotificationActionType.OpenBooking: {
        const bookingId = getOptionalText(payload, "bookingId");
        return bookingId
          ? {
              bookingId,
              type: NotificationActionType.OpenBooking,
            }
          : null;
      }
      case NotificationActionType.OpenTracking:
        return {
          bookingId: getOptionalText(payload, "bookingId"),
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
