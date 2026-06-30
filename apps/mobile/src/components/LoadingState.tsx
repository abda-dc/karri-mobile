import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";
import { Card } from "./Card";

type LoadingStateProps = {
  message: string;
};

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <Card variant="outlined">
      <View
        accessibilityLabel={message}
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        style={styles.status}
      >
        <ActivityIndicator accessible={false} color={colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
      <View
        accessibilityElementsHidden
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.skeleton}
      >
        <View style={styles.line} />
        <View style={[styles.line, styles.mediumLine]} />
        <View style={[styles.line, styles.shortLine]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  status: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  message: {
    color: colors.textSecondary,
    flexShrink: 1,
    ...typography.caption,
  },
  skeleton: {
    gap: spacing.xs,
  },
  line: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 10,
    width: "100%",
  },
  mediumLine: {
    width: "78%",
  },
  shortLine: {
    width: "56%",
  },
});
