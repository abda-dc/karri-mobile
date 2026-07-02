import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

type BadgeTone = "gold" | "info" | "neutral" | "primary";

type BadgeProps = {
  accessibilityLabel?: string;
  label: string;
  tone?: BadgeTone;
};

const tones = {
  gold: { backgroundColor: colors.goldSoft, color: colors.gold },
  info: { backgroundColor: colors.skySoft, color: colors.sky },
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.textSecondary },
  primary: { backgroundColor: colors.primarySoft, color: colors.primary },
};

export function Badge({ accessibilityLabel, label, tone = "neutral" }: BadgeProps) {
  const selectedTone = tones[tone];

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="text"
      accessible
      style={[styles.badge, { backgroundColor: selectedTone.backgroundColor }]}
    >
      <Text style={[styles.label, { color: selectedTone.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  label: {
    ...typography.caption,
    fontWeight: "800",
  },
});
