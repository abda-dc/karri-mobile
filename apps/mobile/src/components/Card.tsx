import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, layout, radii, shadows, spacing } from "../theme/tokens";

type CardProps = {
  children: ReactNode;
  padding?: "compact" | "default" | "none";
  style?: StyleProp<ViewStyle>;
  variant?: "elevated" | "outlined" | "soft";
};

export function Card({
  children,
  padding = "default",
  style,
  variant = "outlined",
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        styles[variant],
        padding === "compact" && styles.compact,
        padding === "none" && styles.noPadding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    gap: spacing.md,
    padding: layout.cardPadding,
  },
  elevated: {
    ...shadows.low,
    borderColor: colors.border,
    borderWidth: 1,
  },
  outlined: {
    borderColor: colors.border,
    borderWidth: 1,
  },
  soft: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.primarySoft,
    borderWidth: 1,
  },
  compact: {
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  noPadding: {
    padding: 0,
  },
});
