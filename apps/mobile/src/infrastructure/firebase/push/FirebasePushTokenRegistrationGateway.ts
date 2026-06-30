import {
  PushRegistrationAvailability,
  PushRegistrationStatus,
  type PushRegistrationResult,
  type PushTokenRegistrationGateway,
} from "../../../application/services/PushRegistrationService";
import type { PushToken } from "../../../application/notifications/PushToken";

const deferredReason =
  "Push token registration is intentionally deferred and does not request notification permission.";

export class FirebasePushTokenRegistrationGateway
  implements PushTokenRegistrationGateway
{
  readonly availability = PushRegistrationAvailability.Deferred;

  async register(_userId: string): Promise<PushRegistrationResult> {
    return {
      reason: deferredReason,
      status: PushRegistrationStatus.Deferred,
    };
  }

  async unregister(_token: PushToken): Promise<PushRegistrationResult> {
    return {
      reason: deferredReason,
      status: PushRegistrationStatus.Deferred,
    };
  }
}
