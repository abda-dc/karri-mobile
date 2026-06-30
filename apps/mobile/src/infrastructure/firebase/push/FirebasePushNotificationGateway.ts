import {
  PushDeliveryAvailability,
  PushDeliveryStatus,
  type PushDeliveryResult,
  type PushNotificationGateway,
  type PushNotificationRequest,
} from "../../../application/services/PushNotificationService";

const deferredReason =
  "Push delivery is intentionally deferred until permission, privacy, and trusted delivery work is implemented.";

export class FirebasePushNotificationGateway implements PushNotificationGateway {
  readonly availability = PushDeliveryAvailability.Deferred;

  async deliver(_request: PushNotificationRequest): Promise<PushDeliveryResult> {
    return {
      reason: deferredReason,
      status: PushDeliveryStatus.Deferred,
    };
  }
}
