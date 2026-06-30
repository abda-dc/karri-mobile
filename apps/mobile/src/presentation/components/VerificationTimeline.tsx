import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import type { VerificationEvent } from "../../domain/identity/VerificationEvent";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { getVerificationStatusLabel } from "./IdentityBadge";

interface VerificationTimelineProps {
  readonly events: ReadonlyArray<VerificationEvent>;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Time unavailable";
}

function formatActor(actorType: VerificationEvent["actorType"]): string {
  switch (actorType) {
    case "user":
      return "You";
    case "reviewer":
      return "Reviewer";
    case "system":
      return "System";
  }
}

export function VerificationTimeline({ events }: VerificationTimelineProps) {
  const chronologicalEvents = [...events].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  return (
    <Card padding="compact" variant="outlined">
      <View style={styles.heading}>
        <Text style={styles.title}>Verification timeline</Text>
        <Text style={styles.supporting}>Oldest to newest audit events</Text>
      </View>

      {chronologicalEvents.length === 0 ? (
        <Text style={styles.empty}>No verification events have been recorded.</Text>
      ) : (
        <View style={styles.timeline}>
          {chronologicalEvents.map((event, index) => (
            <View key={event.id} style={styles.eventRow}>
              <View style={styles.rail}>
                <View style={styles.dot} />
                {index < chronologicalEvents.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.eventCopy}>
                <Text style={styles.eventTitle}>
                  {getVerificationStatusLabel(event.status)}
                </Text>
                <Text style={styles.eventMeta}>
                  {formatActor(event.actorType)} · {formatTimestamp(event.createdAt)}
                </Text>
                {event.reason ? <Text style={styles.reason}>{event.reason}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xxs,
  },
  title: {
    color: colors.text,
    ...typography.label,
  },
  supporting: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  empty: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  timeline: {
    gap: spacing.none,
  },
  eventRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing.sm,
  },
  rail: {
    alignItems: "center",
    width: 18,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  line: {
    backgroundColor: colors.borderStrong,
    flex: 1,
    marginVertical: spacing.xxs,
    width: 2,
  },
  eventCopy: {
    flex: 1,
    gap: spacing.xxs,
    paddingBottom: spacing.md,
  },
  eventTitle: {
    color: colors.text,
    ...typography.label,
  },
  eventMeta: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  reason: {
    color: colors.text,
    ...typography.caption,
  },
});
