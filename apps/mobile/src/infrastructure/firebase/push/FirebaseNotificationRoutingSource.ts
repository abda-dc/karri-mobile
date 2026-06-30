import {
  notificationPushPayloadToAction,
  validateNotificationPushPayload,
} from "../../../application/notifications/NotificationPushPayload";
import {
  type NotificationAction,
} from "../../../application/notifications/NotificationAction";
import type { NotificationRoutingSource } from "../../../application/services/NotificationRouter";

export class FirebaseNotificationRoutingSource implements NotificationRoutingSource {
  parseAction(payload: unknown): NotificationAction | null {
    const validation = validateNotificationPushPayload(payload);
    return validation.valid
      ? notificationPushPayloadToAction(validation.payload)
      : null;
  }
}
