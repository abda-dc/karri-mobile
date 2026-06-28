import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../theme/tokens";

type FormCardProps = {
  children: ReactNode;
};

export function FormCard({ children }: FormCardProps) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
