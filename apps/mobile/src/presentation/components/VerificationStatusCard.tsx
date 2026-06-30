import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import {
  VerificationLevel,
  VerificationStatus,
} from "../../domain/identity/IdentityVerification";
import type { IdentityVerificationStatusSummary } from "../../application/services/IdentityVerificationService";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { IdentityBadge } from "./IdentityBadge";

interface VerificationStatusCardProps {
  readonly summary: IdentityVerificationStatusSummary | null;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unavailable";
}

function getLevelLabel(level: VerificationLevel): string {
  switch (level) {
    case VerificationLevel.Basic:
      return "Basic verification in progress";
    case VerificationLevel.IdentityVerified:
      return "Identity verified";
    case VerificationLevel.None:
      return "No verification level";
  }
}

function getNextAction(summary: IdentityVerificationStatusSummary): string {
  switch (summary.status) {
    case VerificationStatus.Unverified:
      return "Identity verification is being prepared. No action is available yet.";
    case VerificationStatus.Draft:
      return summary.documentCount > 0
        ? "Document metadata is present. Submission controls will arrive in a future phase."
        : "Document collection is not available yet. This foundation is read-only.";
    case VerificationStatus.Submitted:
      return "Your verification has been submitted. A future review workflow will handle it.";
    case VerificationStatus.UnderReview:
      return "Your verification is under review. No action is required right now.";
    case VerificationStatus.Verified:
      return summary.expiresAt
        ? "Your identity is verified until the expiry shown below."
        : "Your identity is verified. Continue to protect your account access.";
    case VerificationStatus.Rejected:
      return "This verification needs attention. A future phase will support starting a revised draft.";
    case VerificationStatus.Expired:
      return "This verification has expired. Renewal controls are not available yet.";
    case VerificationStatus.Revoked:
      return "This verification was revoked. Contact support when the reviewed support path is available.";
  }
}

function createEmptySummary(): IdentityVerificationStatusSummary {
  return {
    status: VerificationStatus.Unverified,
    level: VerificationLevel.None,
    documentCount: 0,
    allowedTransitions: [VerificationStatus.Draft],
    submittedAt: null,
    reviewedAt: null,
    expiresAt: null,
    rejectionReason: null,
    revokedReason: null,
  };
}

export function VerificationStatusCard({ summary }: VerificationStatusCardProps) {
  const visibleSummary = summary ?? createEmptySummary();
  const dates = [
    { label: "Submitted", value: visibleSummary.submittedAt },
    { label: "Reviewed", value: visibleSummary.reviewedAt },
    { label: "Expires", value: visibleSummary.expiresAt },
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));

  return (
    <Card variant="soft">
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Identity verification</Text>
          <Text style={styles.supporting}>Read-only verification foundation</Text>
        </View>
        <IdentityBadge status={visibleSummary.status} />
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{getLevelLabel(visibleSummary.level)}</Text>
          <Text style={styles.metricLabel}>Verification level</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{visibleSummary.documentCount}</Text>
          <Text style={styles.metricLabel}>Document metadata records</Text>
        </View>
      </View>

      {dates.length > 0 ? (
        <View style={styles.details}>
          {dates.map((entry) => (
            <View key={entry.label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{entry.label}</Text>
              <Text style={styles.detailValue}>{formatTimestamp(entry.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.nextAction}>
        <Text style={styles.nextActionLabel}>What happens next</Text>
        <Text style={styles.nextActionText}>{getNextAction(visibleSummary)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 190,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  supporting: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  metric: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 150,
  },
  metricValue: {
    color: colors.text,
    ...typography.label,
  },
  metricLabel: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  details: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  detailLabel: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  detailValue: {
    color: colors.text,
    ...typography.caption,
  },
  nextAction: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xxs,
    padding: spacing.md,
  },
  nextActionLabel: {
    color: colors.text,
    ...typography.label,
  },
  nextActionText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
