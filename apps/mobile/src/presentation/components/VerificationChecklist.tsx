import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../../components/Banner";
import { Card } from "../../components/Card";
import type { IdentityVerificationStatusSummary } from "../../application/services/IdentityVerificationService";
import {
  VerificationStatus,
  type VerificationStatus as VerificationStatusValue,
} from "../../domain/identity/IdentityVerification";
import { colors, radii, spacing, typography } from "../../theme/tokens";

interface VerificationChecklistProps {
  readonly summary: IdentityVerificationStatusSummary;
}

const submittedStatuses = new Set<VerificationStatusValue>([
  VerificationStatus.Submitted,
  VerificationStatus.UnderReview,
  VerificationStatus.Verified,
  VerificationStatus.Rejected,
  VerificationStatus.Expired,
  VerificationStatus.Revoked,
]);
const reviewedStatuses = new Set<VerificationStatusValue>([
  VerificationStatus.UnderReview,
  VerificationStatus.Verified,
  VerificationStatus.Rejected,
  VerificationStatus.Expired,
  VerificationStatus.Revoked,
]);
const verifiedStatuses = new Set<VerificationStatusValue>([
  VerificationStatus.Verified,
  VerificationStatus.Expired,
  VerificationStatus.Revoked,
]);

export function VerificationChecklist({ summary }: VerificationChecklistProps) {
  const steps = [
    {
      label: "Draft started",
      complete: summary.status !== VerificationStatus.Unverified,
    },
    { label: "Document metadata added", complete: summary.documentCount > 0 },
    { label: "Submitted", complete: submittedStatuses.has(summary.status) },
    { label: "Under review", complete: reviewedStatuses.has(summary.status) },
    { label: "Verified", complete: verifiedStatuses.has(summary.status) },
  ];

  const outcome =
    summary.status === VerificationStatus.Rejected
      ? {
          title: "Verification needs attention",
          message:
            summary.rejectionReason ??
            "A reviewer did not approve this submission. Revision controls are not available yet.",
          variant: "warning" as const,
        }
      : summary.status === VerificationStatus.Expired
        ? {
            title: "Verification expired",
            message: "Previously completed verification is no longer current.",
            variant: "warning" as const,
          }
        : summary.status === VerificationStatus.Revoked
          ? {
              title: "Verification revoked",
              message:
                summary.revokedReason ??
                "This verification is no longer valid. A reviewed support path is still required.",
              variant: "error" as const,
            }
          : null;

  return (
    <Card padding="compact" variant="outlined">
      <View style={styles.heading}>
        <Text style={styles.title}>Verification checklist</Text>
        <Text style={styles.supporting}>Progress is read-only in this phase.</Text>
      </View>

      <View style={styles.steps}>
        {steps.map((step) => (
          <View key={step.label} style={styles.step}>
            <View
              accessibilityLabel={`${step.label}: ${step.complete ? "complete" : "not complete"}`}
              style={[styles.marker, step.complete && styles.markerComplete]}
            >
              <Text style={[styles.markerText, step.complete && styles.markerTextComplete]}>
                {step.complete ? "✓" : ""}
              </Text>
            </View>
            <Text style={[styles.stepLabel, step.complete && styles.stepLabelComplete]}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>

      {outcome ? (
        <Banner
          compact
          message={outcome.message}
          title={outcome.title}
          variant={outcome.variant}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xxs,
  },
  title: {
    color: colors.text,
    ...typography.label,
  },
  supporting: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  marker: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  markerComplete: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  markerText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  markerTextComplete: {
    color: colors.success,
    fontWeight: "800",
  },
  stepLabel: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  stepLabelComplete: {
    color: colors.text,
    fontWeight: "700",
  },
});
