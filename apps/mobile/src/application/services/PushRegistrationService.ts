import {
  assertPushToken,
  type PushToken,
} from "../notifications/PushToken";
import type { NotificationPermissionStatus } from "../notifications/NotificationPermission";
import { DomainValidationError, requireText } from "./validation";

const installationIdPattern = /^karri-[a-z0-9-]{16,100}$/;

export interface PushRegistrationIdentity {
  readonly userId: string;
  readonly deviceId: string;
}

export function assertPushRegistrationIdentity(
  identity: PushRegistrationIdentity,
  expectedUserId: string,
): void {
  if (
    !identity.userId ||
    identity.userId !== expectedUserId ||
    identity.userId !== identity.userId.trim() ||
    identity.userId.length > 128
  ) {
    throw new DomainValidationError("Push registration must belong to the active user.");
  }
  if (!installationIdPattern.test(identity.deviceId)) {
    throw new DomainValidationError("Push registration requires a valid installation ID.");
  }
}

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

export const ExistingPushInstallationStatus = {
  Deferred: "deferred",
  Found: "found",
  Missing: "missing",
} as const;

export type ExistingPushInstallationResult =
  | {
      readonly reason: string;
      readonly status: typeof ExistingPushInstallationStatus.Deferred;
    }
  | {
      readonly deviceId: string;
      readonly status: typeof ExistingPushInstallationStatus.Found;
    }
  | {
      readonly status: typeof ExistingPushInstallationStatus.Missing;
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
  readonly unregistrationAvailability: PushRegistrationAvailability;
  getExistingInstallationId(): Promise<ExistingPushInstallationResult>;
  getPermissionStatus(): Promise<NotificationPermissionStatus>;
  register(userId: string): Promise<PushRegistrationResult>;
  unregister(identity: PushRegistrationIdentity): Promise<PushRegistrationResult>;
}

export interface PushTokenRepository {
  remove(identity: PushRegistrationIdentity): Promise<PushTokenPersistenceResult>;
  save(token: PushToken): Promise<PushTokenPersistenceResult>;
}

export class PushRegistrationService {
  private operationGeneration = 0;
  private operationTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly registrationGateway: PushTokenRegistrationGateway,
    private readonly tokens: PushTokenRepository,
  ) {}

  get availability(): PushRegistrationAvailability {
    return this.registrationGateway.availability;
  }

  get unregistrationAvailability(): PushRegistrationAvailability {
    return this.registrationGateway.unregistrationAvailability;
  }

  getPermissionStatus(): Promise<NotificationPermissionStatus> {
    return this.registrationGateway.getPermissionStatus();
  }

  invalidatePendingOperations(): void {
    this.operationGeneration += 1;
    this.operationTail = Promise.resolve();
  }

  register(userId: string): Promise<PushRegistrationResult> {
    return this.runExclusive((generation) =>
      this.registerExclusive(userId, generation),
    );
  }

  private async registerExclusive(
    userId: string,
    generation: number,
  ): Promise<PushRegistrationResult> {
    const activeUserId = requireText(userId, "userId", 128);
    if (!this.isCurrentGeneration(generation)) {
      return this.supersededResult();
    }

    const registration = await this.registrationGateway.register(activeUserId);
    if (!this.isCurrentGeneration(generation)) {
      return this.supersededResult();
    }
    if (registration.status !== PushRegistrationStatus.Registered) {
      return registration;
    }
    assertPushToken(registration.token, activeUserId);

    if (!this.isCurrentGeneration(generation)) {
      return this.supersededResult();
    }

    const persistence = await this.tokens.save(registration.token);
    if (!this.isCurrentGeneration(generation)) {
      return this.supersededResult();
    }

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

  unregisterCurrentInstallation(
    userId: string,
  ): Promise<PushRegistrationResult> {
    return this.runExclusive((generation) =>
      this.unregisterCurrentInstallationExclusive(userId, generation),
    );
  }

  private async unregisterCurrentInstallationExclusive(
    userId: string,
    generation: number,
  ): Promise<PushRegistrationResult> {
    const activeUserId = requireText(userId, "userId", 128);
    if (activeUserId !== userId) {
      throw new DomainValidationError("userId must be trimmed.");
    }
    if (!this.isCurrentGeneration(generation)) {
      return this.supersededResult();
    }

    let existing: ExistingPushInstallationResult;
    try {
      existing = await this.registrationGateway.getExistingInstallationId();
    } catch {
      return {
        reason: "The stored installation identity could not be read safely.",
        status: PushRegistrationStatus.Deferred,
      };
    }
    if (!this.isCurrentGeneration(generation)) {
      return this.supersededResult();
    }
    if (existing.status === ExistingPushInstallationStatus.Missing) {
      return { status: PushRegistrationStatus.Unregistered };
    }
    if (existing.status === ExistingPushInstallationStatus.Deferred) {
      return existing;
    }

    const identity: PushRegistrationIdentity = {
      deviceId: existing.deviceId,
      userId: activeUserId,
    };
    try {
      assertPushRegistrationIdentity(identity, activeUserId);
    } catch {
      return {
        reason: "The stored installation identity is invalid.",
        status: PushRegistrationStatus.Deferred,
      };
    }

    let registration: PushRegistrationResult;
    try {
      registration = await this.registrationGateway.unregister(identity);
    } catch {
      return {
        reason: "Device unregistration could not be prepared safely.",
        status: PushRegistrationStatus.Deferred,
      };
    }
    if (!this.isCurrentGeneration(generation)) {
      return this.supersededResult();
    }
    if (registration.status !== PushRegistrationStatus.Unregistered) {
      return registration;
    }

    const persistence = await this.tokens.remove(identity);
    if (!this.isCurrentGeneration(generation)) {
      return this.supersededResult();
    }

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

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.operationGeneration;
  }

  private supersededResult(): PushRegistrationResult {
    return {
      reason: "The push operation was superseded by sign-out.",
      status: PushRegistrationStatus.Deferred,
    };
  }

  private runExclusive<T>(
    operation: (generation: number) => Promise<T>,
  ): Promise<T> {
    const generation = this.operationGeneration;
    const result = this.operationTail.then(
      () => operation(generation),
      () => operation(generation),
    );

    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }
}
