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
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.primarySoft,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  marker: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  markerText: {
    color: colors.primary,
    ...typography.subheading,
  },
  copy: {
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    textAlign: "center",
    ...typography.subheading,
  },
  description: {
    color: colors.textSecondary,
    maxWidth: 380,
    textAlign: "center",
    ...typography.body,
  },
  action: {
    alignSelf: "stretch",
    marginTop: spacing.xs,
  },
});
