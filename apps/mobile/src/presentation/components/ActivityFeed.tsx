import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import type { Booking } from "../../domain/booking/Booking";
import {
  CustodyEventType,
  type CustodyEvent,
} from "../../domain/custody/CustodyEvent";
import type { IdentityVerification } from "../../domain/identity/IdentityVerification";
import type { Notification } from "../../domain/notification/Notification";
import type { TrustSummary } from "../../domain/trust/TrustScore";
import { colors, spacing, typography } from "../../theme/tokens";
import { TimelineEventRow, type TimelineEventViewModel } from "./TimelineEventRow";
import {
  actorLabel,
  bookingStatusLabels,
  custodyEventLabels,
} from "./operationalPresentation";

interface ActivityFeedProps {
  readonly booking: Booking;
  readonly custodyEvents: ReadonlyArray<CustodyEvent>;
  readonly currentUserId: string;
  readonly identityVerification: IdentityVerification | null;
  readonly notifications: ReadonlyArray<Notification>;
  readonly trustSummary: TrustSummary | null;
}

const custodyActivityTypes: ReadonlyArray<CustodyEventType> = [
  CustodyEventType.TravelerAccepted,
  CustodyEventType.PickupConfirmed,
  CustodyEventType.DeliveryConfirmed,
  CustodyEventType.Completed,
];

function timelineExplanation(event: CustodyEvent): string {
  const kind = custodyActivityTypes.includes(event.eventType) ? "custody" : "shipment";
  const context = [event.location ? `Location: ${event.location}.` : "", event.note ?? ""]
    .filter(Boolean)
    .join(" ");
  return context || `A ${kind} update was added to the shared journey.`;
}

function sortNewestFirst(
  left: TimelineEventViewModel,
  right: TimelineEventViewModel,
): number {
  return (right.timestamp ?? "").localeCompare(left.timestamp ?? "");
}

export function ActivityFeed({
  booking,
  custodyEvents,
  currentUserId,
  identityVerification,
  notifications,
  trustSummary,
}: ActivityFeedProps) {
  const bookingEvents: ReadonlyArray<TimelineEventViewModel> = booking.statusHistory.map(
    (entry, index) => ({
      actor: actorLabel(entry.changedBy, booking, currentUserId),
      explanation: `The booking moved to ${bookingStatusLabels[entry.status].toLowerCase()}.`,
      icon: "B",
      id: `booking:${entry.status}:${entry.changedAt}:${index}`,
      timestamp: entry.changedAt,
      title: bookingStatusLabels[entry.status],
    }),
  );
  const shipmentEvents: ReadonlyArray<TimelineEventViewModel> = custodyEvents.map((event) => ({
    actor: actorLabel(event.performedBy, booking, currentUserId),
    explanation: timelineExplanation(event),
    icon: custodyActivityTypes.includes(event.eventType) ? "C" : "S",
    id: `timeline:${event.id}`,
    timestamp: event.timestamp,
    title: custodyEventLabels[event.eventType],
  }));
  const identityEvents: ReadonlyArray<TimelineEventViewModel> =
    identityVerification?.events.map((event) => ({
      actor: event.actorType === "system" ? "Karri" : event.actorId === currentUserId ? "You" : undefined,
      explanation: `Your identity status changed to ${event.toStatus.replace("_", " ")}.`,
      icon: "ID",
      id: `identity:${event.id}`,
      timestamp: event.createdAt,
      title: event.toStatus === "verified" ? "Identity verified" : "Identity status updated",
    })) ?? [];
  const trustEvents: ReadonlyArray<TimelineEventViewModel> = trustSummary
    ? [
        {
          explanation: `Visible trust evidence produced a score of ${trustSummary.score.score} out of 100.`,
          icon: "T",
          id: `trust:${trustSummary.score.userId}:${trustSummary.score.calculatedAt}`,
          timestamp: trustSummary.score.calculatedAt,
          title: "Trust summary refreshed",
        },
      ]
    : [];
  const notificationEvents: ReadonlyArray<TimelineEventViewModel> = notifications
    .filter((notification) => notification.relatedEntityId === booking.id)
    .map((notification) => ({
      explanation: notification.body,
      icon: "N",
      id: `notification:${notification.id}`,
      timestamp: notification.createdAt,
      title: notification.title,
    }));
  const events = [
    ...bookingEvents,
    ...shipmentEvents,
    ...identityEvents,
    ...trustEvents,
    ...notificationEvents,
  ].sort(sortNewestFirst);

  return (
    <Card padding="compact" variant="elevated">
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Activity feed</Text>
        <Text style={styles.title}>What happened</Text>
        <Text style={styles.muted}>
          Newest first across booking, shipment, custody, trust, identity, and in-app updates.
        </Text>
      </View>

      {events.length === 0 ? (
        <Text style={styles.muted}>No activity is available yet.</Text>
      ) : (
        events.map((event, index) => (
          <TimelineEventRow key={event.id} event={event} last={index === events.length - 1} />
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
