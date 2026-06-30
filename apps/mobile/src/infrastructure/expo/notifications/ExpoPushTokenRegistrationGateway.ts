import { NotificationPermissionStatus } from "../../../application/notifications/NotificationPermission";
import type { PushToken } from "../../../application/notifications/PushToken";
import {
  PushRegistrationAvailability,
  PushRegistrationStatus,
  type PushRegistrationResult,
  type PushTokenRegistrationGateway,
} from "../../../application/services/PushRegistrationService";

const unsupportedReason =
  "Push registration is available only in configured Android and iOS builds.";

export class ExpoPushTokenRegistrationGateway
  implements PushTokenRegistrationGateway
{
  readonly availability = PushRegistrationAvailability.Deferred;

  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    return NotificationPermissionStatus.Unsupported;
  }

  async register(_userId: string): Promise<PushRegistrationResult> {
    return {
      reason: unsupportedReason,
      status: PushRegistrationStatus.Deferred,
    };
  }

  async unregister(_token: PushToken): Promise<PushRegistrationResult> {
    return {
      reason: unsupportedReason,
      status: PushRegistrationStatus.Deferred,
    };
  }
}
