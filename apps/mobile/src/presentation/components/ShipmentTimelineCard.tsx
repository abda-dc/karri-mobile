import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import type { Booking } from "../../domain/booking/Booking";
import type { ShipmentLifecycleEvent } from "../../domain/shipment/ShipmentLifecycleEvent";
import { colors, spacing, typography } from "../../theme/tokens";
import { TimelineEventRow, type TimelineEventViewModel } from "./TimelineEventRow";
import { actorLabel, custodyEventLabels } from "./operationalPresentation";

interface ShipmentTimelineCardProps {
  readonly booking: Booking;
  readonly currentUserId: string;
  readonly events: ReadonlyArray<ShipmentLifecycleEvent>;
}

function explanationFor(event: ShipmentLifecycleEvent): string {
  const context = [event.location ? `Location: ${event.location}.` : "", event.note ?? ""]
    .filter(Boolean)
    .join(" ");
  return context || "This update was added to the shared shipment history.";
}

export function ShipmentTimelineCard({
  booking,
  currentUserId,
  events,
}: ShipmentTimelineCardProps) {
  const rows: ReadonlyArray<TimelineEventViewModel> = events.map((event) => ({
    actor: actorLabel(event.performedBy, booking, currentUserId),
    explanation: explanationFor(event),
    icon: "S",
    id: event.id,
    timestamp: event.timestamp,
    title: custodyEventLabels[event.eventType],
  }));

  return (
    <Card padding="compact" variant="outlined">
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Shipment timeline</Text>
        <Text style={styles.title}>Journey history</Text>
        <Text style={styles.muted}>Oldest to newest, using the canonical custody record.</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.muted}>No shipment timeline events are available yet.</Text>
      ) : (
        rows.map((event, index) => (
          <TimelineEventRow key={event.id} event={event} last={index === rows.length - 1} />
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xxs,
  },
  eyebrow: {
    color: colors.primary,
    ...typography.overline,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  muted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
