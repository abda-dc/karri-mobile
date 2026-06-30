import type { PushToken } from "../notifications/PushToken";

export const PushRegistrationAvailability = {
  Available: "available",
  Deferred: "deferred",
} as const;

export type PushRegistrationAvailability =
  (typeof PushRegistrationAvailability)[keyof typeof PushRegistrationAvailability];

export const PushRegistrationStatus = {
  Deferred: "deferred",
  Registered: "registered",
  Unregistered: "unregistered",
} as const;

export type PushRegistrationResult =
  | {
      readonly reason: string;
      readonly status: typeof PushRegistrationStatus.Deferred;
    }
  | {
      readonly status: typeof PushRegistrationStatus.Registered;
      readonly token: PushToken;
    }
  | {
      readonly status: typeof PushRegistrationStatus.Unregistered;
    };

export const PushTokenPersistenceStatus = {
  Deferred: "deferred",
  Removed: "removed",
  Stored: "stored",
} as const;

export type PushTokenPersistenceResult =
  | {
      readonly reason: string;
      readonly status: typeof PushTokenPersistenceStatus.Deferred;
    }
  | {
      readonly status:
        | typeof PushTokenPersistenceStatus.Removed
        | typeof PushTokenPersistenceStatus.Stored;
    };

export interface PushTokenRegistrationGateway {
  readonly availability: PushRegistrationAvailability;
  register(userId: string): Promise<PushRegistrationResult>;
  unregister(token: PushToken): Promise<PushRegistrationResult>;
}

export interface PushTokenRepository {
  remove(token: PushToken): Promise<PushTokenPersistenceResult>;
  save(token: PushToken): Promise<PushTokenPersistenceResult>;
}

export class PushRegistrationService {
  constructor(
    private readonly registrationGateway: PushTokenRegistrationGateway,
    private readonly tokens: PushTokenRepository,
  ) {}

  get availability(): PushRegistrationAvailability {
    return this.registrationGateway.availability;
  }

  async register(userId: string): Promise<PushRegistrationResult> {
    const registration = await this.registrationGateway.register(userId);
    if (registration.status !== PushRegistrationStatus.Registered) {
      return registration;
    }

    const persistence = await this.tokens.save(registration.token);
    if (persistence.status !== PushTokenPersistenceStatus.Stored) {
      return {
        reason:
          persistence.status === PushTokenPersistenceStatus.Deferred
            ? persistence.reason
            : "Push token storage was not confirmed.",
        status: PushRegistrationStatus.Deferred,
      };
    }

    return registration;
  }

  async unregister(token: PushToken): Promise<PushRegistrationResult> {
    const registration = await this.registrationGateway.unregister(token);
    if (registration.status !== PushRegistrationStatus.Unregistered) {
      return registration;
    }

    const persistence = await this.tokens.remove(token);
    if (persistence.status !== PushTokenPersistenceStatus.Removed) {
      return {
        reason:
          persistence.status === PushTokenPersistenceStatus.Deferred
            ? persistence.reason
            : "Push token removal was not confirmed.",
        status: PushRegistrationStatus.Deferred,
      };
    }

    return registration;
  }
}
