import { NotificationPermissionStatus } from "../../../application/notifications/NotificationPermission";
import {
  ExistingPushInstallationStatus,
  PushRegistrationAvailability,
  PushRegistrationStatus,
  type ExistingPushInstallationResult,
  type PushRegistrationIdentity,
  type PushRegistrationResult,
  type PushTokenRegistrationGateway,
} from "../../../application/services/PushRegistrationService";

const unsupportedReason =
  "Push registration is available only in configured Android and iOS builds.";

export class ExpoPushTokenRegistrationGateway
  implements PushTokenRegistrationGateway
{
  readonly availability = PushRegistrationAvailability.Deferred;
  readonly unregistrationAvailability = PushRegistrationAvailability.Deferred;

  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    return NotificationPermissionStatus.Unsupported;
  }

  async getExistingInstallationId(): Promise<ExistingPushInstallationResult> {
    return {
      reason: unsupportedReason,
      status: ExistingPushInstallationStatus.Deferred,
    };
  }

  async register(_userId: string): Promise<PushRegistrationResult> {
    return {
      reason: unsupportedReason,
      status: PushRegistrationStatus.Deferred,
    };
  }

  async unregister(
    _identity: PushRegistrationIdentity,
  ): Promise<PushRegistrationResult> {
    return {
      reason: unsupportedReason,
      status: PushRegistrationStatus.Deferred,
    };
  }
}
