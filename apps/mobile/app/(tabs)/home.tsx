import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../../src/components/AppScreen";
import { InfoCard } from "../../src/components/InfoCard";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { StatusPill } from "../../src/components/StatusPill";
import { useAuthSession } from "../../src/lib/auth";
import {
  getFriendlyFirestoreError,
  subscribeToActiveShipments,
  subscribeToActiveTrips,
} from "../../src/lib/firestore";
import { colors, spacing, typography } from "../../src/theme/tokens";
import type { Shipment, Trip } from "../../src/types/models";

type CorridorMatch = {
  shipment: Shipment;
  trip: Trip;
};

function normalizeRoutePart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function corridorsMatch(shipment: Shipment, trip: Trip): boolean {
  return (
    normalizeRoutePart(shipment.originCountry) === normalizeRoutePart(trip.originCountry) &&
    normalizeRoutePart(shipment.originCity) === normalizeRoutePart(trip.originCity) &&
    normalizeRoutePart(shipment.destinationCountry) ===
      normalizeRoutePart(trip.destinationCountry) &&
    normalizeRoutePart(shipment.destinationCity) === normalizeRoutePart(trip.destinationCity)
  );
}

export default function AppHomeScreen() {
  const auth = useAuthSession();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading) {
      return;
    }

    if (!auth.user) {
      setShipments([]);
      setTrips([]);
      setShipmentsLoading(false);
      setTripsLoading(false);
      return;
    }

    setShipmentsLoading(true);
    setTripsLoading(true);
    setDataError(null);

    const unsubscribers: Array<() => void> = [];

    try {
      unsubscribers.push(
        subscribeToActiveShipments(
          (nextShipments) => {
            setShipments(nextShipments);
            setShipmentsLoading(false);
          },
          (error) => {
            setDataError(getFriendlyFirestoreError(error));
            setShipmentsLoading(false);
          },
        ),
      );
      unsubscribers.push(
        subscribeToActiveTrips(
          (nextTrips) => {
            setTrips(nextTrips);
            setTripsLoading(false);
          },
          (error) => {
            setDataError(getFriendlyFirestoreError(error));
            setTripsLoading(false);
          },
        ),
      );
    } catch (error) {
      setDataError(getFriendlyFirestoreError(error));
      setShipmentsLoading(false);
      setTripsLoading(false);
    }

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [auth.loading, auth.user]);

  const matches = useMemo<CorridorMatch[]>(
    () =>
      shipments.flatMap((shipment) =>
        trips
          .filter((trip) => corridorsMatch(shipment, trip))
          .map((trip) => ({ shipment, trip })),
      ),
    [shipments, trips],
  );

  const isLoading = auth.loading || shipmentsLoading || tripsLoading;

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Karri home"
        title="Possible corridor matches"
        subtitle="Karri compares active shipment and trip origins and destinations exactly. These are leads to evaluate, not bookings or safety guarantees."
      />

      <View style={styles.actions}>
        <PrimaryButton onPress={() => router.push("/(tabs)/send")}>Send a package</PrimaryButton>
        <PrimaryButton variant="secondary" onPress={() => router.push("/(tabs)/travel")}>
          I&apos;m traveling
        </PrimaryButton>
        <PrimaryButton variant="secondary" onPress={() => router.push("/(tabs)/tracking")}>
          Track a booking
        </PrimaryButton>
      </View>

      {!auth.loading && !auth.user ? (
        <View style={styles.section}>
          <InfoCard
            title={auth.error ? "Firebase setup or sign-in needed" : "Sign in to find matches"}
            body={
              auth.error ??
              "Active route inventory is available only to authenticated Karri accounts."
            }
          />
          <PrimaryButton onPress={() => router.push("/login")}>Open sign in</PrimaryButton>
        </View>
      ) : null}

      {auth.user ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Exact route matches</Text>
            {!isLoading && !dataError ? <StatusPill label={`${matches.length} found`} /> : null}
          </View>

          {isLoading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.mutedText}>Comparing active routes...</Text>
            </View>
          ) : null}

          {!isLoading && dataError ? (
            <InfoCard title="Could not load matches" body={dataError} />
          ) : null}

          {!isLoading && !dataError && matches.length === 0 ? (
            <InfoCard
              title="No exact matches yet"
              body="Create shipment and trip listings with the same origin country/city and destination country/city to see a possible match here."
            />
          ) : null}

          {!isLoading && !dataError
            ? matches.map(({ shipment, trip }) => (
                <View key={`${shipment.id}:${trip.id}`} style={styles.matchCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>
                      {shipment.originCity} → {shipment.destinationCity}
                    </Text>
                    <StatusPill label="Possible match" />
                  </View>
                  <Text style={styles.routeText}>
                    {shipment.originCountry} → {shipment.destinationCountry}
                  </Text>
                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Shipment</Text>
                    <Text style={styles.mutedText}>
                      {shipment.packageCategory} · {shipment.weightKg} kg · {shipment.rewardAmount}{" "}
                      {shipment.rewardCurrency}
                    </Text>
                    <Text style={styles.mutedText}>
                      Desired window: {shipment.deliveryWindow}
                    </Text>
                  </View>
                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Trip</Text>
                    <Text style={styles.mutedText}>
                      {trip.departureDate} → {trip.arrivalDate} · {trip.availableCapacityKg} kg available
                    </Text>
                  </View>
                  <Text style={styles.disclaimer}>
                    Date, weight, category, and participant eligibility are not checked by this first match.
                  </Text>
                </View>
              ))
            : null}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.headline,
    fontWeight: "900",
  },
  stateBlock: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  matchCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  cardTitle: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  routeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  detailGroup: {
    gap: 2,
  },
  detailLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  mutedText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  disclaimer: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
  },
});
