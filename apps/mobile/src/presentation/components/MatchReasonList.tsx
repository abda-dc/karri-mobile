import { StyleSheet, Text, View } from "react-native";
import {
  MatchReasonTone,
  type MatchReason,
} from "../../domain/matching/MatchReason";
import { colors, radii, spacing, typography } from "../../theme/tokens";

interface MatchReasonListProps {
  readonly heading?: string;
  readonly maximumVisible?: number;
  readonly reasons: ReadonlyArray<MatchReason>;
}

const markers: Readonly<Record<MatchReason["tone"], string>> = {
  [MatchReasonTone.Positive]: "+",
  [MatchReasonTone.Neutral]: "i",
  [MatchReasonTone.Cautionary]: "!",
  [MatchReasonTone.Blocking]: "x",
};

export function MatchReasonList({
  heading = "Why this match?",
  maximumVisible,
  reasons,
}: MatchReasonListProps) {
  const visible = maximumVisible ? reasons.slice(0, maximumVisible) : reasons;
  const hiddenCount = reasons.length - visible.length;

  return (
    <View style={styles.list}>
      <Text style={styles.heading}>{heading}</Text>
      {visible.map((reason) => (
        <View key={`${reason.factor}:${reason.code}`} style={styles.reason}>
          <View style={[styles.marker, styles[reason.tone]]}>
            <Text style={[styles.markerText, styles[`${reason.tone}Text`]]}>
              {markers[reason.tone]}
            </Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{reason.title}</Text>
            <Text style={styles.explanation}>{reason.explanation}</Text>
          </View>
        </View>
      ))}
      {hiddenCount > 0 ? (
        <Text style={styles.more}>{hiddenCount} additional scoring factors are included.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  heading: { color: colors.text, ...typography.label },
  reason: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  marker: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  positive: { backgroundColor: colors.successSoft },
  neutral: { backgroundColor: colors.surfaceMuted },
  cautionary: { backgroundColor: colors.warningSoft },
  blocking: { backgroundColor: colors.errorSoft },
  markerText: { ...typography.caption, fontWeight: "900" },
  positiveText: { color: colors.success },
  neutralText: { color: colors.textSecondary },
  cautionaryText: { color: colors.warning },
  blockingText: { color: colors.error },
  copy: { flex: 1, gap: spacing.xxs },
  title: { color: colors.text, ...typography.label },
  explanation: { color: colors.textSecondary, ...typography.caption },
  more: { color: colors.muted, ...typography.caption },
});
