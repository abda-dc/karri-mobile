import type { IdentityVerification } from "./IdentityVerification";

export interface VerificationRepository {
  findByUserId(userId: string): Promise<IdentityVerification | null>;
  save(verification: IdentityVerification): Promise<IdentityVerification>;
}
