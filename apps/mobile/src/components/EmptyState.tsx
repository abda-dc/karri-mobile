import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  marker?: string;
  title: string;
};

export function EmptyState({ action, description, marker = "K", title }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View
        accessibilityElementsHidden
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.marker}
      >
        <Text style={styles.markerText}>{marker}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  marker: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 68,
    justifyContent: "center",
    width: 68,
  },
  markerText: {
    color: colors.primaryDark,
    ...typography.headline,
  },
  copy: {
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: 400,
  },
  title: {
    color: colors.text,
    textAlign: "center",
    ...typography.subheading,
    fontWeight: "800",
  },
  description: {
    color: colors.textSecondary,
    textAlign: "center",
    ...typography.body,
  },
  action: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
  },
});
