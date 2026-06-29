import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { colors, radii, spacing, touchTargets, typography } from "../theme/tokens";

type PrimaryButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onPress?: PressableProps["onPress"];
  style?: StyleProp<ViewStyle>;
  variant?: "ghost" | "primary" | "secondary";
};

export function PrimaryButton({
  children,
  disabled = false,
  loading = false,
  onPress,
  style,
  variant = "primary",
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const activityColor = variant === "primary" ? colors.white : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={touchTargets.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={activityColor} size="small" /> : null}
      <Text style={[styles.text, styles[`${variant}Text`]]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.bodyStrong,
    textAlign: "center",
  },
  primaryText: {
    color: colors.white,
  },
  secondaryText: {
    color: colors.primaryDark,
  },
  ghostText: {
    color: colors.primary,
  },
});
