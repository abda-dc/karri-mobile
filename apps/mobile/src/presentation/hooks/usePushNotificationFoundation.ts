import { useMemo } from "react";
import type { NotificationAction } from "../../application/notifications/NotificationAction";
import type { PushDeliveryAvailability } from "../../application/services/PushNotificationService";
import type { PushRegistrationAvailability } from "../../application/services/PushRegistrationService";
import type { NotificationRoute } from "../../application/services/NotificationRouter";
import { mobileServices } from "../services/mobileServices";

export interface PushNotificationFoundation {
  readonly deliveryAvailability: PushDeliveryAvailability;
  readonly registrationAvailability: PushRegistrationAvailability;
  resolveAction(action: NotificationAction): NotificationRoute;
  resolvePayload(payload: unknown): NotificationRoute | null;
}

export function usePushNotificationFoundation(): PushNotificationFoundation {
  return useMemo(
    () => ({
      deliveryAvailability: mobileServices.pushNotification.availability,
      registrationAvailability: mobileServices.pushRegistration.availability,
      resolveAction: (action: NotificationAction) =>
        mobileServices.notificationRouter.resolve(action),
      resolvePayload: (payload: unknown) =>
        mobileServices.notificationRouter.resolvePayload(payload),
    }),
    [],
  );
}
