export interface FirebaseAdminUser {
  readonly uid: string;
  readonly email?: string | null;
  readonly providerIds?: readonly string[];
  readonly customClaims?: { [key: string]: any };
}

export interface FirebaseAdminGateway {
  setCustomUserClaims(uid: string, claims: object | null): Promise<void>;
  getUser(uid: string): Promise<FirebaseAdminUser>;
  revokeRefreshTokens(uid: string): Promise<void>;
}

export interface FirebaseAdminConsoleGateway extends FirebaseAdminGateway {
  getUserByEmail(email: string): Promise<FirebaseAdminUser>;
}
