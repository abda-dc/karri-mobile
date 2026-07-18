import type { AuthorizationRole } from "../../domain/authorization/roles";

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
  signOut(): Promise<void>;
  startMvpSession(): Promise<AuthenticatedSession>;
  signInWithEmail(email: string, password: string): Promise<AuthenticatedSession>;
  refreshAuthorization(): Promise<{ readonly uid: string; readonly role: AuthorizationRole } | null>;
  subscribe(
    onChange: (session: AuthenticatedSession | null) => void,
    onError: (error: unknown) => void,
  ): () => void;
}

export class AuthSessionService {
  constructor(private readonly gateway: AuthSessionGateway) {}

  get isConfigured(): boolean {
    return this.gateway.configured;
  }

  signOut(): Promise<void> {
    return this.gateway.signOut();
  }

  startMvpSession(): Promise<AuthenticatedSession> {
    return this.gateway.startMvpSession();
  }

  signInWithEmail(email: string, password: string): Promise<AuthenticatedSession> {
    return this.gateway.signInWithEmail(email, password);
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
}
