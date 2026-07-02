import { StyleSheet, Text, View } from "react-native";
import type { MatchScore } from "../../domain/matching/MatchScore";
import { colors, radii, spacing, typography } from "../../theme/tokens";

interface MatchScoreBadgeProps {
  readonly score: MatchScore;
}

export function MatchScoreBadge({ score }: MatchScoreBadgeProps) {
  const tone = score.total >= 75 ? "strong" : score.total >= 50 ? "medium" : "review";
  return (
    <View
      accessibilityLabel={`Match score ${score.total} out of ${score.maximum}`}
      style={[styles.badge, styles[tone]]}
    >
      <Text style={[styles.score, styles[`${tone}Text`]]}>{score.total}</Text>
      <Text style={[styles.maximum, styles[`${tone}Text`]]}>/{score.maximum}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "baseline",
    alignSelf: "flex-start",
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  strong: { backgroundColor: colors.successSoft },
  medium: { backgroundColor: colors.skySoft },
  review: { backgroundColor: colors.warningSoft },
  score: { ...typography.subheading },
  maximum: { ...typography.caption, fontWeight: "800" },
  strongText: { color: colors.success },
  mediumText: { color: colors.sky },
  reviewText: { color: colors.warning },
});
