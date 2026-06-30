import {
  PushTokenPersistenceStatus,
  type PushTokenPersistenceResult,
  type PushTokenRepository,
} from "../../../application/services/PushRegistrationService";
import type { PushToken } from "../../../application/notifications/PushToken";

const deferredReason =
  "Push token persistence is intentionally deferred; no token was written to Firestore.";

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
