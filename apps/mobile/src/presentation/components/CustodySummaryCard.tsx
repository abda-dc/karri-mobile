import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { StatusChip } from "../../components/StatusChip";
import { CustodyEventType, type CustodyEvent } from "../../domain/custody/CustodyEvent";
import { colors, spacing, typography } from "../../theme/tokens";
import { custodyEventLabels, formatTimestamp } from "./operationalPresentation";

interface CustodySummaryCardProps {
  readonly events: ReadonlyArray<CustodyEvent>;
}

function responsibilityLabel(eventType: CustodyEventType | undefined): string {
  switch (eventType) {
    case CustodyEventType.PickupConfirmed:
    case CustodyEventType.AirportDeparture:
    case CustodyEventType.AirportArrival:
      return "Traveler responsibility recorded";
    case CustodyEventType.DeliveryConfirmed:
      return "Delivery handoff recorded";
    case CustodyEventType.Completed:
      return "Custody journey closed";
    case CustodyEventType.TravelerAccepted:
      return "Traveler acceptance recorded";
    case CustodyEventType.ShipmentCreated:
      return "Sender responsibility recorded";
    default:
      return "No custody event yet";
  }
}

export function CustodySummaryCard({ events }: CustodySummaryCardProps) {
  const latest = events[events.length - 1];

  return (
    <Card padding="compact" variant="outlined">
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Custody summary</Text>
          <Text style={styles.title}>{responsibilityLabel(latest?.eventType)}</Text>
        </View>
        <StatusChip label={`${events.length} events`} tone={events.length > 0 ? "info" : "neutral"} />
      </View>

      {latest ? (
        <View style={styles.details}>
          <Text style={styles.label}>Latest record: {custodyEventLabels[latest.eventType]}</Text>
          <Text style={styles.muted}>{formatTimestamp(latest.timestamp)}</Text>
          {latest.location ? <Text style={styles.muted}>Location: {latest.location}</Text> : null}
          {latest.note ? <Text style={styles.muted}>{latest.note}</Text> : null}
        </View>
      ) : (
        <Text style={styles.muted}>Custody history will appear after the booking is linked.</Text>
      )}

      <Text style={styles.note}>
        Records show what participants entered in Karri. They are not proof of physical custody.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 190,
  },
  eyebrow: {
    color: colors.primary,
    ...typography.overline,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  label: {
    color: colors.text,
    ...typography.label,
  },
  muted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  details: {
    gap: spacing.xxs,
  },
  note: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    color: colors.muted,
    paddingTop: spacing.sm,
    ...typography.caption,
  },
});
