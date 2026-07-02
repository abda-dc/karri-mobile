export interface AuthIdentity {
  readonly uid: string;
  readonly createdAt: string | null;
  readonly isAnonymous: boolean;
}

export interface AuthSessionGateway {
  readonly configured: boolean;
  signOut(): Promise<void>;
  startMvpSession(): Promise<AuthIdentity>;
  subscribe(
    onChange: (identity: AuthIdentity | null) => void,
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

  startMvpSession(): Promise<AuthIdentity> {
    return this.gateway.startMvpSession();
  }

  subscribe(
    onChange: (identity: AuthIdentity | null) => void,
    onError: (error: unknown) => void,
  ): () => void {
    return this.gateway.subscribe(onChange, onError);
  }
}
