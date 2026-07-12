export interface FirebaseAdminGateway {
  setCustomUserClaims(uid: string, claims: object | null): Promise<void>;
  getUser(uid: string): Promise<{ uid: string; customClaims?: { [key: string]: any } }>;
  revokeRefreshTokens(uid: string): Promise<void>;
}
