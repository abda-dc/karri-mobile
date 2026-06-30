import type { DomainEntity } from "../shared/Entity";
import type { IdentityDocument } from "./IdentityDocument";
import type { VerificationEvent } from "./VerificationEvent";

export const VerificationStatus = {
  Unverified: "unverified",
  Draft: "draft",
  Submitted: "submitted",
  UnderReview: "under_review",
  Verified: "verified",
  Rejected: "rejected",
  Expired: "expired",
  Revoked: "revoked",
} as const;

export type VerificationStatus =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const VerificationLevel = {
  None: "none",
  Basic: "basic",
  IdentityVerified: "identity_verified",
} as const;

export type VerificationLevel =
  (typeof VerificationLevel)[keyof typeof VerificationLevel];

export interface IdentityVerification extends DomainEntity {
  readonly userId: string;
  readonly status: VerificationStatus;
  readonly level: VerificationLevel;
  readonly documents: ReadonlyArray<IdentityDocument>;
  readonly events: ReadonlyArray<VerificationEvent>;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly expiresAt: string | null;
  readonly rejectionReason: string | null;
  readonly revokedReason: string | null;
}

export function getVerificationLevel(status: VerificationStatus): VerificationLevel {
  if (status === VerificationStatus.Verified) {
    return VerificationLevel.IdentityVerified;
  }

  return status === VerificationStatus.Draft ||
    status === VerificationStatus.Submitted ||
    status === VerificationStatus.UnderReview
    ? VerificationLevel.Basic
    : VerificationLevel.None;
}
