import { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, spacing } from "../theme/tokens";

type PrimaryButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  variant?: "primary" | "secondary";
};

export function PrimaryButton({
  children,
  disabled = false,
  onPress,
  variant = "primary",
}: PrimaryButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.text, isPrimary ? styles.primaryText : styles.secondaryText]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    fontSize: 16,
    fontWeight: "800",
  },
  primaryText: {
    color: "#FFFFFF",
  },
  secondaryText: {
    color: colors.primaryDark,
  },
});
