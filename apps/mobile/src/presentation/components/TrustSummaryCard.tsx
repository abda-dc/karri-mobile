import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Booking } from "../../domain/booking/Booking";
import type { TrustSummary } from "../../domain/trust/TrustScore";
import { Card } from "../../components/Card";
import { StatusChip } from "../../components/StatusChip";
import { colors, spacing, typography } from "../../theme/tokens";
import { mobileServices } from "../services/mobileServices";

interface TrustSummaryCardProps {
  readonly accountCreatedAt?: string | null;
  readonly bookings?: ReadonlyArray<Booking>;
  readonly compact?: boolean;
  readonly refreshKey?: string | number;
  readonly title?: string;
  readonly userId: string;
}

export function TrustSummaryCard({
  accountCreatedAt,
  bookings,
  compact = false,
  refreshKey,
  title = "Trust summary",
  userId,
}: TrustSummaryCardProps) {
  const [summary, setSummary] = useState<TrustSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void mobileServices.trust
      .getVisibleSummary(userId, { accountCreatedAt, bookings, verificationLevel: "none" })
      .then((nextSummary) => {
        if (active) {
          setSummary(nextSummary);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setSummary(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accountCreatedAt, bookings, refreshKey, userId]);

  if (loading) {
    return (
      <Card padding="compact" style={styles.loading} variant="soft">
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.muted}>Loading trust evidence...</Text>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card padding="compact" variant="soft">
        <Text style={styles.muted}>Trust evidence is not available right now.</Text>
      </Card>
    );
  }

  return (
    <Card padding="compact" variant="soft">
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.muted}>
            {summary.evidenceScope === "participant_history"
              ? "Your eligible booking and review history"
              : "Visible completed-review evidence"}
          </Text>
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
              Verification: {summary.inputs.verificationLevel}
            </Text>
            {summary.score.factors.map((factor) => (
              <Text key={factor.key} style={styles.explanation}>
                {factor.explanation}
              </Text>
            ))}
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
});
