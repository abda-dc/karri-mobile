import { StatusChip } from "../../components/StatusChip";
import {
  VerificationStatus,
  type VerificationStatus as VerificationStatusValue,
} from "../../domain/identity/IdentityVerification";

type StatusChipTone = "active" | "info" | "neutral" | "success" | "warning";

interface IdentityBadgeProps {
  readonly status: VerificationStatusValue;
}

const statusPresentation: Readonly<
  Record<VerificationStatusValue, { readonly label: string; readonly tone: StatusChipTone }>
> = {
  [VerificationStatus.Unverified]: { label: "Not verified", tone: "neutral" },
  [VerificationStatus.Draft]: { label: "Draft", tone: "info" },
  [VerificationStatus.Submitted]: { label: "Submitted", tone: "active" },
  [VerificationStatus.UnderReview]: { label: "Under review", tone: "warning" },
  [VerificationStatus.Verified]: { label: "Identity verified", tone: "success" },
  [VerificationStatus.Rejected]: { label: "Needs attention", tone: "warning" },
  [VerificationStatus.Expired]: { label: "Expired", tone: "neutral" },
  [VerificationStatus.Revoked]: { label: "Revoked", tone: "warning" },
};

export function getVerificationStatusLabel(status: VerificationStatusValue): string {
  return statusPresentation[status].label;
}

export function IdentityBadge({ status }: IdentityBadgeProps) {
  const presentation = statusPresentation[status];
  return <StatusChip label={presentation.label} tone={presentation.tone} />;
}
