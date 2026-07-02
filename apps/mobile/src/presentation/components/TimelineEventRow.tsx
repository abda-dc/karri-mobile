import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { formatTimestamp } from "./operationalPresentation";

export interface TimelineEventViewModel {
  readonly actor?: string;
  readonly explanation: string;
  readonly icon: string;
  readonly id: string;
  readonly timestamp: string | null;
  readonly title: string;
}

interface TimelineEventRowProps {
  readonly event: TimelineEventViewModel;
  readonly last?: boolean;
}

export function TimelineEventRow({ event, last = false }: TimelineEventRowProps) {
  const accessibilityLabel = [
    event.title,
    event.explanation,
    formatTimestamp(event.timestamp),
    event.actor ? `By ${event.actor}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      accessible
      style={styles.row}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.rail}
      >
        <View style={styles.icon}>
          <Text style={styles.iconText}>{event.icon}</Text>
        </View>
        {!last ? <View style={styles.line} /> : null}
      </View>
      <View style={[styles.copy, !last && styles.copyWithDivider]}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.explanation}>{event.explanation}</Text>
        <View style={styles.meta}>
          <Text style={styles.timestamp}>{formatTimestamp(event.timestamp)}</Text>
          {event.actor ? <Text style={styles.actor}>By {event.actor}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing.sm,
  },
  rail: {
    alignItems: "center",
    width: 36,
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  iconText: {
    color: colors.primary,
    ...typography.overline,
  },
  line: {
    backgroundColor: colors.border,
    flex: 1,
    marginTop: spacing.xxs,
    width: 2,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
    paddingBottom: spacing.md,
  },
  copyWithDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  title: {
    color: colors.text,
    ...typography.label,
  },
  explanation: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  timestamp: {
    color: colors.muted,
    ...typography.caption,
  },
  actor: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "700",
  },
});
