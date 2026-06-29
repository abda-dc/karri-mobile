import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

type TrustBadgeProps = {
  compact?: boolean;
  detail?: string;
  label?: string;
};

export function TrustBadge({
  compact = false,
  detail,
  label = "Trust-centered",
}: TrustBadgeProps) {
  return (
    <View style={[styles.badge, compact && styles.compact]}>
      <View
        accessibilityElementsHidden
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[styles.mark, compact && styles.compactMark]}
      >
        <Text style={styles.markText}>K</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.goldSoft,
    borderColor: "#EAD8A8",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  compact: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  compactMark: {
    height: 24,
    width: 24,
  },
  markText: {
    color: colors.white,
    ...typography.caption,
    fontWeight: "900",
  },
  copy: {
    flexShrink: 1,
  },
  label: {
    color: colors.forest,
    ...typography.label,
  },
  detail: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
