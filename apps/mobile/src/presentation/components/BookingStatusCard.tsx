import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { StatusChip } from "../../components/StatusChip";
import type { Booking, BookingRequest } from "../../domain/booking/Booking";
import { BookingStatus } from "../../domain/booking/Booking";
import type { VerificationStatus } from "../../domain/identity/IdentityVerification";
import { colors, spacing, typography } from "../../theme/tokens";
import { IdentityBadge } from "./IdentityBadge";
import { bookingStatusLabels, shortId } from "./operationalPresentation";

interface BookingStatusCardProps {
  readonly booking: Booking;
  readonly bookingRequest?: BookingRequest;
  readonly currentUserId: string;
  readonly identityStatus: VerificationStatus;
  readonly pendingStatus?: Booking["status"] | null;
}

function statusTone(status: Booking["status"]): "active" | "neutral" | "success" | "warning" {
  if (status === BookingStatus.Completed) return "success";
  const endedStatuses: ReadonlyArray<Booking["status"]> = [
    BookingStatus.Cancelled,
    BookingStatus.Declined,
    BookingStatus.Expired,
  ];
  if (endedStatuses.includes(status)) {
    return "neutral";
  }
  return status === BookingStatus.Pending ? "warning" : "active";
}

export function BookingStatusCard({
  booking,
  bookingRequest,
  currentUserId,
  identityStatus,
  pendingStatus,
}: BookingStatusCardProps) {
  const currentRole = booking.senderId === currentUserId ? "Sender" : "Traveler";

  return (
    <Card padding="compact" variant="soft">
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Booking status</Text>
          <Text style={styles.title}>{bookingStatusLabels[booking.status]}</Text>
          <Text style={styles.muted}>Booking {shortId(booking.id)}</Text>
        </View>
        <StatusChip label={bookingStatusLabels[booking.status]} tone={statusTone(booking.status)} />
      </View>

      {pendingStatus ? (
        <StatusChip label={`${bookingStatusLabels[pendingStatus]} pending`} tone="warning" />
      ) : null}

      <View style={styles.participants}>
        <View style={styles.participant}>
          <Text style={styles.label}>Sender</Text>
          <Text style={styles.muted}>
            {booking.senderId === currentUserId ? "You" : shortId(booking.senderId)}
          </Text>
        </View>
        <View style={styles.participant}>
          <Text style={styles.label}>Traveler</Text>
          <Text style={styles.muted}>
            {booking.travelerId === currentUserId ? "You" : shortId(booking.travelerId)}
          </Text>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View style={styles.identityCopy}>
          <Text style={styles.label}>Your identity</Text>
          <Text style={styles.muted}>{currentRole} on this booking</Text>
        </View>
        <IdentityBadge status={identityStatus} />
      </View>

      {bookingRequest ? (
        <View style={styles.message}>
          <Text style={styles.label}>
            Request {bookingRequest.status.replace("_", " ")}
          </Text>
          {bookingRequest.message ? (
            <Text style={styles.muted}>{bookingRequest.message}</Text>
          ) : (
            <Text style={styles.muted}>No request note was added.</Text>
          )}
        </View>
      ) : null}
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
  participants: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  participant: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 120,
  },
  identityRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  identityCopy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 150,
  },
  message: {
    gap: spacing.xxs,
  },
});
