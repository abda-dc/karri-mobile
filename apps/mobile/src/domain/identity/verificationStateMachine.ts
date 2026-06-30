import { VerificationStatus } from "./IdentityVerification";

const allowedTransitions: Readonly<
  Record<VerificationStatus, ReadonlyArray<VerificationStatus>>
> = {
  [VerificationStatus.Unverified]: [VerificationStatus.Draft],
  [VerificationStatus.Draft]: [VerificationStatus.Submitted],
  [VerificationStatus.Submitted]: [VerificationStatus.UnderReview],
  [VerificationStatus.UnderReview]: [
    VerificationStatus.Verified,
    VerificationStatus.Rejected,
  ],
  [VerificationStatus.Verified]: [
    VerificationStatus.Expired,
    VerificationStatus.Revoked,
  ],
  [VerificationStatus.Rejected]: [VerificationStatus.Draft],
  [VerificationStatus.Expired]: [VerificationStatus.Draft],
  [VerificationStatus.Revoked]: [],
};

export class InvalidVerificationTransitionError extends Error {
  constructor(currentStatus: VerificationStatus, nextStatus: VerificationStatus) {
    super(
      `Identity verification cannot transition from ${currentStatus} to ${nextStatus}.`,
    );
    this.name = "InvalidVerificationTransitionError";
  }
}

export function canTransitionVerificationStatus(
  currentStatus: VerificationStatus,
  nextStatus: VerificationStatus,
): boolean {
  return allowedTransitions[currentStatus].includes(nextStatus);
}

export function assertCanTransitionVerificationStatus(
  currentStatus: VerificationStatus,
  nextStatus: VerificationStatus,
): void {
  if (!canTransitionVerificationStatus(currentStatus, nextStatus)) {
    throw new InvalidVerificationTransitionError(currentStatus, nextStatus);
  }
}

export function getAllowedVerificationTransitions(
  status: VerificationStatus,
): ReadonlyArray<VerificationStatus> {
  return [...allowedTransitions[status]];
}
