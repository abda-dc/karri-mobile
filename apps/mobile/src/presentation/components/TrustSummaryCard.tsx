import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Booking } from "../../domain/booking/Booking";
import {
  VerificationLevel as IdentityVerificationLevel,
  type VerificationLevel as IdentityVerificationLevelValue,
} from "../../domain/identity/IdentityVerification";
import type {
  TrustFactorResult,
  TrustSummary,
  VerificationLevel as TrustVerificationLevel,
} from "../../domain/trust/TrustScore";
import { Banner } from "../../components/Banner";
import { Card } from "../../components/Card";
import { StatusChip } from "../../components/StatusChip";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { reportFriendlyError } from "../errors/getFriendlyError";
import { mobileServices } from "../services/mobileServices";

interface TrustSummaryCardProps {
  readonly accountCreatedAt?: string | null;
  readonly bookings?: ReadonlyArray<Booking>;
  readonly compact?: boolean;
  readonly refreshKey?: string | number;
  readonly title?: string;
  readonly userId: string;
  readonly verificationLevel?: IdentityVerificationLevelValue;
}

type TrustEvidenceCategory = "positive" | "missing" | "cautionary";

const factorLabels: Readonly<Record<TrustFactorResult["key"], string>> = {
  completed_deliveries: "Completed deliveries",
  cancellations: "Cancellations",
  average_review: "Eligible reviews",
  account_age: "Account age",
  verification_level: "Identity verification",
};

const categoryLabels: Readonly<Record<TrustEvidenceCategory, string>> = {
  positive: "Positive evidence",
  missing: "Missing evidence",
  cautionary: "Cautionary evidence",
};

function toTrustVerificationLevel(
  level: IdentityVerificationLevelValue | undefined,
): TrustVerificationLevel {
  switch (level) {
    case IdentityVerificationLevel.Basic:
      return "basic";
    case IdentityVerificationLevel.IdentityVerified:
      return "identity";
    case IdentityVerificationLevel.None:
    case undefined:
      return "none";
  }
}

function getTrustVerificationLabel(level: TrustVerificationLevel): string {
  switch (level) {
    case "basic":
      return "Basic in progress";
    case "identity":
      return "Identity verified";
    case "none":
      return "None";
  }
}

function getEvidenceCategory(factor: TrustFactorResult): TrustEvidenceCategory {
  if (factor.key === "cancellations") {
    return factor.points < 0 ? "cautionary" : "positive";
  }
  return factor.points > 0 ? "positive" : "missing";
}

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

function getImprovementGuidance(summary: TrustSummary): ReadonlyArray<string> {
  if (summary.evidenceScope !== "participant_history") {
    return [];
  }

  const guidance: Array<string> = [];
  if (summary.inputs.completedDeliveries < 10) {
    guidance.push("Eligible completed deliveries add evidence, up to 10 deliveries in formula v1.");
  }
  if (summary.inputs.reviewCount === 0) {
    guidance.push("Eligible completed-booking reviews add review evidence.");
  }
  if (summary.inputs.verificationLevel === "none") {
    guidance.push(
      "A future trusted identity review can add one verification factor; starting a profile alone does not.",
    );
  } else if (summary.inputs.verificationLevel === "basic") {
    guidance.push(
      "Completed trusted identity review can raise the verification factor from basic to verified.",
    );
  }
  if (summary.inputs.cancellations > 0) {
    guidance.push(
      "Avoiding additional cancellations prevents further deductions; existing formula-v1 deductions remain visible.",
    );
  }
  if (summary.inputs.accountAgeDays < 365) {
    guidance.push("Account-age evidence grows gradually until one year in formula v1.");
  }
  return guidance;
}

export function TrustSummaryCard({
  accountCreatedAt,
  bookings,
  compact = false,
  refreshKey,
  title = "Trust summary",
  userId,
  verificationLevel,
}: TrustSummaryCardProps) {
  const [summary, setSummary] = useState<TrustSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void mobileServices.trust
      .getVisibleSummary(userId, {
        accountCreatedAt,
        bookings,
        verificationLevel:
          verificationLevel === undefined
            ? undefined
            : toTrustVerificationLevel(verificationLevel),
      })
      .then((nextSummary) => {
        if (active) {
          setSummary(nextSummary);
          setLoading(false);
        }
      })
      .catch((summaryError) => {
        const message = reportFriendlyError(summaryError, "trust.load-summary");
        if (active) {
          setSummary(null);
          setError(message);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accountCreatedAt, bookings, refreshKey, userId, verificationLevel]);

  if (loading) {
    return (
      <Card padding="compact" style={styles.loading} variant="soft">
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.muted}>Loading trust evidence...</Text>
      </Card>
    );
  }

  if (error) {
    return <Banner compact message={error} title="Trust summary unavailable" variant="error" />;
  }

  if (!summary) {
    return (
      <Card padding="compact" variant="soft">
        <Text style={styles.muted}>Trust evidence is not available right now.</Text>
      </Card>
    );
  }

  const visibleFactors =
    summary.evidenceScope === "reviews_only"
      ? summary.score.factors.filter(
          (factor) =>
            factor.key === "completed_deliveries" || factor.key === "average_review",
        )
      : summary.score.factors;
  const categories: ReadonlyArray<TrustEvidenceCategory> = [
    "positive",
    "missing",
    "cautionary",
  ];
  const improvementGuidance = getImprovementGuidance(summary);

  return (
    <Card padding="compact" variant="soft">
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.muted}>
            {summary.evidenceScope === "participant_history"
              ? "Your eligible private and review evidence"
              : "Visible completed-review evidence"}
          </Text>
          <Text style={styles.formula}>Formula v{summary.score.formulaVersion}</Text>
        </View>
        <StatusChip
          label={
            summary.inputs.completedDeliveries === 0 && summary.inputs.reviewCount === 0
              ? "New"
              : `${summary.score.score}/100`
          }
          tone="active"
        />
      </View>

      <View style={styles.factors}>
        <Text style={styles.factor}>Completed deliveries: {summary.inputs.completedDeliveries}</Text>
        <Text style={styles.factor}>
          Average review: {summary.inputs.averageReview?.toFixed(1) ?? "No reviews"}
        </Text>
        {!compact ? (
          <>
            <Text style={styles.factor}>Cancellations: {summary.inputs.cancellations}</Text>
            <Text style={styles.factor}>
              Verification: {getTrustVerificationLabel(summary.inputs.verificationLevel)}
            </Text>
            <View style={styles.factorGroups}>
              {categories.map((category) => {
                const factors = visibleFactors.filter(
                  (factor) => getEvidenceCategory(factor) === category,
                );
                if (factors.length === 0) {
                  return null;
                }

                return (
                  <View key={category} style={styles.factorGroup}>
                    <Text
                      style={[
                        styles.groupTitle,
                        category === "cautionary" && styles.cautionaryTitle,
                      ]}
                    >
                      {categoryLabels[category]}
                    </Text>
                    {factors.map((factor) => (
                      <View key={factor.key} style={styles.factorRow}>
                        <View style={styles.factorHeading}>
                          <Text style={styles.factorName}>{factorLabels[factor.key]}</Text>
                          <Text
                            style={[
                              styles.factorPoints,
                              factor.points < 0 && styles.cautionaryPoints,
                            ]}
                          >
                            {formatPoints(factor.points)} points
                          </Text>
                        </View>
                        <Text style={styles.explanation}>{factor.explanation}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>

            {summary.evidenceScope === "reviews_only" ? (
              <Text style={styles.scopeNote}>
                Private identity, account-age, cancellation, and participant history are
                not read or inferred for another user.
              </Text>
            ) : null}

            {improvementGuidance.length > 0 ? (
              <View style={styles.guidance}>
                <Text style={styles.guidanceTitle}>What can improve this summary</Text>
                {improvementGuidance.map((guidance) => (
                  <Text key={guidance} style={styles.guidanceItem}>
                    • {guidance}
                  </Text>
                ))}
              </View>
            ) : null}

            <Text style={styles.disclaimer}>
              Trust is decision support based on limited evidence, not a safety guarantee.
            </Text>
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    flexDirection: "row",
  },
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
    minWidth: 180,
  },
  title: {
    color: colors.text,
    ...typography.label,
  },
  muted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  formula: {
    color: colors.muted,
    ...typography.overline,
  },
  factors: {
    gap: spacing.xxs,
  },
  factor: {
    color: colors.text,
    ...typography.caption,
  },
  explanation: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  factorGroups: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  factorGroup: {
    gap: spacing.sm,
  },
  groupTitle: {
    color: colors.primary,
    ...typography.overline,
  },
  cautionaryTitle: {
    color: colors.warning,
  },
  factorRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xxs,
    paddingTop: spacing.sm,
  },
  factorHeading: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  factorName: {
    color: colors.text,
    ...typography.label,
  },
  factorPoints: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "800",
  },
  cautionaryPoints: {
    color: colors.warning,
  },
  scopeNote: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  guidance: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  guidanceTitle: {
    color: colors.text,
    ...typography.label,
  },
  guidanceItem: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  disclaimer: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "700",
  },
});
