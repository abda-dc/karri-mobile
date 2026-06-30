import type { VerificationStatus } from "./IdentityVerification";

export const VerificationActorType = {
  User: "user",
  System: "system",
  Reviewer: "reviewer",
} as const;

export type VerificationActorType =
  (typeof VerificationActorType)[keyof typeof VerificationActorType];

export interface VerificationEvent {
  readonly id: string;
  readonly verificationId: string;
  readonly actorId: string | null;
  readonly actorType: VerificationActorType;
  readonly fromStatus: VerificationStatus;
  readonly toStatus: VerificationStatus;
  readonly status: VerificationStatus;
  readonly reason: string | null;
  readonly createdAt: string;
}
