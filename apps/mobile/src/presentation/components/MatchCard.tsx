import { StyleSheet, Text, View } from "react-native";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { StatusChip } from "../../components/StatusChip";
import {
  MatchDataFreshness,
  type MatchResult,
} from "../../domain/matching/MatchResult";
import { colors, spacing, typography } from "../../theme/tokens";
import { MatchReasonList } from "./MatchReasonList";
import { MatchScoreBadge } from "./MatchScoreBadge";

interface MatchCardProps {
  readonly match: MatchResult;
  readonly recommendation: "shipment" | "trip";
}

const freshnessPresentation = {
  [MatchDataFreshness.Live]: {
    detail: "Recommendations were evaluated with an online connection.",
    label: "Live",
    tone: "success" as const,
  },
  [MatchDataFreshness.Cached]: {
    detail: "Recommendations use locally available inventory and may be out of date.",
    label: "Cached",
    tone: "warning" as const,
  },
  [MatchDataFreshness.Unknown]: {
    detail: "Recommendation freshness could not be confirmed. Review details before acting.",
    label: "Freshness unknown",
    tone: "neutral" as const,
  },
};

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function getExplanationHeading(recommendation: MatchCardProps["recommendation"]): string {
  if (recommendation === "trip") {
    return "Why this traveler?";
  }

  if (recommendation === "shipment") {
    return "Why this shipment?";
  }

  return "Why this match?";
}

export function MatchCard({ match, recommendation }: MatchCardProps) {
  const freshness = freshnessPresentation[match.dataFreshness];
  const recommendedTrip = recommendation === "trip";
  const explanationHeading = getExplanationHeading(recommendation);

  return (
    <Card padding="compact" variant="elevated">
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>
            {recommendedTrip
              ? `Traveler ${shortId(match.trip.ownerId)}`
              : `Sender ${shortId(match.shipment.ownerId)}`}
          </Text>
          <Text style={styles.title}>
            {match.shipment.originCity} to {match.shipment.destinationCity}
          </Text>
          <Text style={styles.route}>
            {match.shipment.originCountry} to {match.shipment.destinationCountry}
          </Text>
        </View>
        <MatchScoreBadge score={match.score} />
      </View>

      <View style={styles.chips}>
        <StatusChip
          label={match.eligible ? "Eligible match" : "Review required"}
          tone={match.eligible ? "active" : "warning"}
        />
        <StatusChip label={freshness.label} tone={freshness.tone} />
      </View>

      <View style={styles.meta}>
        <Badge label={match.shipment.packageCategory} tone="primary" />
        <Badge label={`${match.shipment.weightKg} kg shipment`} />
        <Badge label={`${match.trip.availableCapacityKg} kg capacity`} tone="info" />
      </View>

      <View style={styles.details}>
        <Text style={styles.detail}>
          Trip: {match.trip.departureDate} to {match.trip.arrivalDate}
        </Text>
        <Text style={styles.detail}>Delivery window: {match.shipment.deliveryWindow}</Text>
        <Text style={styles.freshness}>{freshness.detail}</Text>
      </View>

      <View style={styles.reasonBlock}>
        <MatchReasonList
          heading={explanationHeading}
          maximumVisible={4}
          reasons={match.reasons}
        />
      </View>

      <Text style={styles.disclaimer}>
        Ranking supports comparison; it does not guarantee safety or authorize a booking.
      </Text>
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
  titleBlock: { flex: 1, gap: spacing.xxs, minWidth: 190 },
  eyebrow: { color: colors.primary, ...typography.overline },
  title: { color: colors.text, ...typography.subheading, fontWeight: "800" },
  route: { color: colors.textSecondary, ...typography.caption },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  details: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xxs,
    paddingTop: spacing.sm,
  },
  detail: { color: colors.textSecondary, ...typography.caption },
  freshness: { color: colors.muted, ...typography.caption },
  reasonBlock: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.sm,
  },
  disclaimer: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    color: colors.textSecondary,
    paddingTop: spacing.sm,
    ...typography.caption,
  },
});
