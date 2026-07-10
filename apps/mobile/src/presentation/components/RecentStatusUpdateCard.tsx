import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { StatusChip } from "../../components/StatusChip";
import type { Booking } from "../../domain/booking/Booking";
import type { Notification } from "../../domain/notification/Notification";
import { NotificationStatus } from "../../domain/notification/Notification";
import type { ShipmentLifecycleEvent } from "../../domain/shipment/ShipmentLifecycleEvent";
import { colors, spacing, typography } from "../../theme/tokens";
import {
  actorLabel,
  bookingStatusLabels,
  custodyEventLabels,
  formatTimestamp,
} from "./operationalPresentation";

type StatusUpdateViewModel = {
  readonly actor?: string;
  readonly body: string;
  readonly source: "booking" | "notification" | "shipment";
  readonly timestamp: string | null;
  readonly title: string;
  readonly unread?: boolean;
};

interface RecentStatusUpdateCardProps {
  readonly booking: Booking;
  readonly currentUserId: string;
  readonly notifications: ReadonlyArray<Notification>;
  readonly shipmentEvents: ReadonlyArray<ShipmentLifecycleEvent>;
}

function sortNewestFirst(
  left: { readonly timestamp: string | null },
  right: { readonly timestamp: string | null },
): number {
  return (right.timestamp ?? "").localeCompare(left.timestamp ?? "");
}

function sortNotificationsNewestFirst(
  left: Notification,
  right: Notification,
): number {
  return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
}

function toNotificationUpdate(
  notification: Notification,
): StatusUpdateViewModel {
  return {
    body: notification.body,
    source: "notification",
    timestamp: notification.createdAt,
    title: notification.title,
    unread: notification.status === NotificationStatus.Unread,
  };
}

function getRecentUpdate({
  booking,
  currentUserId,
  notifications,
  shipmentEvents,
}: RecentStatusUpdateCardProps): StatusUpdateViewModel {
  const bookingNotifications = notifications
    .filter((notification) => notification.relatedEntityId === booking.id)
    .sort(sortNotificationsNewestFirst);
  const unreadNotification = bookingNotifications.find(
    (notification) => notification.status === NotificationStatus.Unread,
  );
  const latestNotification = bookingNotifications[0];

  if (unreadNotification) {
    return toNotificationUpdate(unreadNotification);
  }
  if (latestNotification) {
    return toNotificationUpdate(latestNotification);
  }

  const latestShipmentEvent = [...shipmentEvents].sort(sortNewestFirst)[0];
  if (latestShipmentEvent) {
    return {
      actor: actorLabel(latestShipmentEvent.performedBy, booking, currentUserId),
      body:
        latestShipmentEvent.note ||
        latestShipmentEvent.location ||
        "A shipment milestone was added to the shared journey.",
      source: "shipment",
      timestamp: latestShipmentEvent.timestamp,
      title: custodyEventLabels[latestShipmentEvent.eventType],
    };
  }

  const latestBookingStatus = [...booking.statusHistory].sort((left, right) =>
    (right.changedAt ?? "").localeCompare(left.changedAt ?? ""),
  )[0];

  return {
    actor: latestBookingStatus
      ? actorLabel(latestBookingStatus.changedBy, booking, currentUserId)
      : undefined,
    body: "This booking is ready for the next participant action when available.",
    source: "booking",
    timestamp: latestBookingStatus?.changedAt ?? booking.updatedAt,
    title: bookingStatusLabels[booking.status],
  };
}

function sourceLabel(source: StatusUpdateViewModel["source"]): string {
  switch (source) {
    case "notification":
      return "In-app update";
    case "shipment":
      return "Shipment status";
    case "booking":
      return "Booking status";
  }
}

export function RecentStatusUpdateCard(props: RecentStatusUpdateCardProps) {
  const update = getRecentUpdate(props);

  return (
    <Card padding="compact" variant={update.unread ? "soft" : "outlined"}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Recent status update</Text>
          <Text style={styles.title}>{update.title}</Text>
        </View>
        <StatusChip
          label={update.unread ? "Unread" : sourceLabel(update.source)}
          tone={update.unread ? "warning" : "info"}
        />
      </View>
      <Text style={styles.body}>{update.body}</Text>
      <Text style={styles.muted}>
        {[update.actor, formatTimestamp(update.timestamp)].filter(Boolean).join(" - ")}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    ...typography.body,
  },
  eyebrow: {
    color: colors.primary,
    ...typography.overline,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  muted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 190,
  },
});
