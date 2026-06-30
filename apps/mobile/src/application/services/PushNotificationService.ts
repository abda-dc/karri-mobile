import type { Notification } from "../../domain/notification/Notification";
import type { NotificationAction } from "../notifications/NotificationAction";

export const PushDeliveryAvailability = {
  Available: "available",
  Deferred: "deferred",
} as const;

export type PushDeliveryAvailability =
  (typeof PushDeliveryAvailability)[keyof typeof PushDeliveryAvailability];

export const PushDeliveryStatus = {
  Accepted: "accepted",
  Deferred: "deferred",
} as const;

export type PushDeliveryResult =
  | {
      readonly status: typeof PushDeliveryStatus.Accepted;
    }
  | {
      readonly reason: string;
      readonly status: typeof PushDeliveryStatus.Deferred;
    };

export interface PushNotificationRequest {
  readonly action: NotificationAction;
  readonly notificationId: string;
  readonly recipientId: string;
}

export interface PushNotificationGateway {
  readonly availability: PushDeliveryAvailability;
  deliver(request: PushNotificationRequest): Promise<PushDeliveryResult>;
}

export class PushNotificationService {
  constructor(private readonly gateway: PushNotificationGateway) {}

  get availability(): PushDeliveryAvailability {
    return this.gateway.availability;
  }

  notify(
    notification: Notification,
    action: NotificationAction,
  ): Promise<PushDeliveryResult> {
    return this.gateway.deliver({
      action,
      notificationId: notification.id,
      recipientId: notification.recipientId,
    });
  }
}
