import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

type StatusTone = "active" | "info" | "neutral" | "success" | "warning";

type StatusChipProps = {
  label: string;
  tone?: StatusTone;
};

const tones = {
  active: { backgroundColor: colors.primarySoft, color: colors.primary },
  info: { backgroundColor: colors.skySoft, color: colors.sky },
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.textSecondary },
  success: { backgroundColor: colors.successSoft, color: colors.success },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
};

export function StatusChip({ label, tone = "neutral" }: StatusChipProps) {
  const selectedTone = tones[tone];

  return (
    <View style={[styles.chip, { backgroundColor: selectedTone.backgroundColor }]}>
      <View style={[styles.dot, { backgroundColor: selectedTone.color }]} />
      <Text style={[styles.label, { color: selectedTone.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  dot: {
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  label: {
    ...typography.caption,
    fontWeight: "800",
    textTransform: "capitalize",
  },
});
