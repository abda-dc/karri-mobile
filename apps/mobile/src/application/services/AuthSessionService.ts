import type { AuthorizationRole } from "../../domain/authorization/roles";

const defaultSignOutCleanupTimeoutMs = 3_000;

export interface AuthIdentity {
  readonly uid: string;
  readonly email: string | null;
  readonly createdAt: string | null;
  readonly isAnonymous: boolean;
}

export interface AuthorizationSession {
  readonly role: AuthorizationRole;
}

export interface AuthenticatedSession {
  readonly identity: AuthIdentity;
  readonly authorization: AuthorizationSession;
}

export interface AuthSessionGateway {
  readonly configured: boolean;
  getCurrentUserId(): string | null;
  signOut(expectedUserId: string | null): Promise<void>;
  startMvpSession(): Promise<AuthenticatedSession>;
  signInWithEmail(email: string, password: string): Promise<AuthenticatedSession>;
  refreshAuthorization(): Promise<{ readonly uid: string; readonly role: AuthorizationRole } | null>;
  subscribe(
    onChange: (session: AuthenticatedSession | null) => void,
    onError: (error: unknown) => void,
  ): () => void;
}

export interface AuthSessionSignOutCleanup {
  unregisterCurrentInstallation(userId: string): Promise<unknown>;
  invalidatePendingOperations?(): void;
}

export class AuthSessionService {
  private operationTail: Promise<void> = Promise.resolve();
  private signOutPromise: Promise<void> | null = null;

  constructor(
    private readonly gateway: AuthSessionGateway,
    private readonly signOutCleanup: AuthSessionSignOutCleanup | null = null,
    private readonly signOutCleanupTimeoutMs =
      defaultSignOutCleanupTimeoutMs,
  ) {}

  get isConfigured(): boolean {
    return this.gateway.configured;
  }

  signOut(): Promise<void> {
    if (this.signOutPromise) {
      return this.signOutPromise;
    }

    let operation!: Promise<void>;
    operation = this.runExclusive(async () => {
      const userId = this.gateway.getCurrentUserId();

      if (userId && this.signOutCleanup) {
        await this.runBoundedSignOutCleanup(userId);
      }

      await this.gateway.signOut(userId);
    }).finally(() => {
      if (this.signOutPromise === operation) {
        this.signOutPromise = null;
      }
    });

    this.signOutPromise = operation;
    return operation;
  }

  startMvpSession(): Promise<AuthenticatedSession> {
    return this.runExclusive(() => this.gateway.startMvpSession());
  }

  signInWithEmail(
    email: string,
    password: string,
  ): Promise<AuthenticatedSession> {
    return this.runExclusive(() =>
      this.gateway.signInWithEmail(email, password),
    );
  }

  refreshAuthorization(): Promise<{ readonly uid: string; readonly role: AuthorizationRole } | null> {
    return this.gateway.refreshAuthorization();
  }

  subscribe(
    onChange: (session: AuthenticatedSession | null) => void,
    onError: (error: unknown) => void,
  ): () => void {
    return this.gateway.subscribe(onChange, onError);
  }

  private async runBoundedSignOutCleanup(
    userId: string,
  ): Promise<void> {
    const cleanup = this.signOutCleanup;
    if (!cleanup) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;

    try {
      const outcome = await Promise.race([
        cleanup.unregisterCurrentInstallation(userId).then(
          () => "completed" as const,
          () => "failed" as const,
        ),
        new Promise<"timed-out">((resolve) => {
          timeout = setTimeout(
            () => resolve("timed-out"),
            this.signOutCleanupTimeoutMs,
          );
        }),
      ]);

      if (outcome === "timed-out") {
        try {
          cleanup.invalidatePendingOperations?.();
        } catch {
          // Queue invalidation is best effort and must not block sign-out.
        }
      }
    } catch {
      // Cleanup failures are private and must never prevent sign-out.
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation);

    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }
}
