import { StyleSheet, Text, View } from "react-native";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { StatusChip } from "../../components/StatusChip";
import type { Booking } from "../../domain/booking/Booking";
import type { Shipment } from "../../domain/shipment/Shipment";
import type { Trip } from "../../domain/trip/Trip";
import { colors, spacing, typography } from "../../theme/tokens";
import { bookingStatusLabels } from "./operationalPresentation";

interface ShipmentStatusCardProps {
  readonly bookingStatus: Booking["status"];
  readonly shipment: Shipment | null;
  readonly trip: Trip | null;
}

export function ShipmentStatusCard({ bookingStatus, shipment, trip }: ShipmentStatusCardProps) {
  return (
    <Card padding="compact" variant="outlined">
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Shipment summary</Text>
          <Text style={styles.title}>
            {shipment ? `${shipment.originCity} to ${shipment.destinationCity}` : "Loading shipment"}
          </Text>
        </View>
        <StatusChip label={bookingStatusLabels[bookingStatus]} tone="info" />
      </View>

      {shipment ? (
        <>
          <Text style={styles.route}>
            {shipment.originCountry} to {shipment.destinationCountry}
          </Text>
          <View style={styles.badges}>
            <Badge label={shipment.packageCategory} tone="primary" />
            <Badge label={`${shipment.weightKg} kg`} />
            <Badge label={`${shipment.rewardAmount} ${shipment.rewardCurrency}`} tone="gold" />
          </View>
          <Text style={styles.body}>{shipment.packageDescription}</Text>
          <Text style={styles.muted}>Delivery window: {shipment.deliveryWindow}</Text>
          <Text style={styles.muted}>Listing status: {shipment.status}</Text>
        </>
      ) : null}

      {trip ? (
        <View style={styles.trip}>
          <Text style={styles.label}>Traveler schedule</Text>
          <Text style={styles.muted}>{trip.departureDate} to {trip.arrivalDate}</Text>
          <Text style={styles.muted}>{trip.availableCapacityKg} kg listed capacity</Text>
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
  route: {
    color: colors.primary,
    ...typography.label,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  body: {
    color: colors.text,
    ...typography.body,
  },
  muted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  trip: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xxs,
    paddingTop: spacing.sm,
  },
});
