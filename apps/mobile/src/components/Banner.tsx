import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

type BannerVariant = "development" | "error" | "info" | "success" | "warning";

type BannerProps = {
  compact?: boolean;
  message: string;
  title: string;
  variant?: BannerVariant;
};

const toneStyles = {
  development: {
    backgroundColor: colors.skySoft,
    borderColor: "#C8E2F2",
    dotColor: colors.sky,
  },
  error: {
    backgroundColor: colors.errorSoft,
    borderColor: "#F1C7C3",
    dotColor: colors.error,
  },
  info: {
    backgroundColor: colors.skySoft,
    borderColor: "#C8E2F2",
    dotColor: colors.sky,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: "#C6E4D3",
    dotColor: colors.success,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: "#F2D6A8",
    dotColor: colors.warning,
  },
};

export function Banner({ compact = false, message, title, variant = "info" }: BannerProps) {
  const tone = toneStyles[variant];

  return (
    <View
      accessibilityLiveRegion={variant === "error" ? "assertive" : "polite"}
      accessibilityRole={variant === "error" ? "alert" : undefined}
      style={[
        styles.banner,
        { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor },
        compact && styles.compact,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: tone.dotColor }]} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "flex-start",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  compact: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  dot: {
    borderRadius: radii.pill,
    height: 9,
    marginTop: 5,
    width: 9,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    color: colors.text,
    ...typography.label,
  },
  message: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
