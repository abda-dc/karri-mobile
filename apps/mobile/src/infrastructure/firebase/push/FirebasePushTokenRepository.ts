import {
  PushTokenPersistenceStatus,
  type PushTokenPersistenceResult,
  type PushTokenRepository,
} from "../../../application/services/PushRegistrationService";
import type { PushToken } from "../../../application/notifications/PushToken";

const deferredReason =
  "Trusted server token persistence is not implemented; no token was stored or enabled for delivery.";

export class FirebasePushTokenRepository implements PushTokenRepository {
  async remove(_token: PushToken): Promise<PushTokenPersistenceResult> {
    return {
      reason: deferredReason,
      status: PushTokenPersistenceStatus.Deferred,
    };
  }

  async save(_token: PushToken): Promise<PushTokenPersistenceResult> {
    return {
      reason: deferredReason,
      status: PushTokenPersistenceStatus.Deferred,
    };
  }
}
