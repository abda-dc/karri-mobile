import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import { TrustBadge } from "../../src/components/TrustBadge";
import { useAuthSession } from "../../src/presentation/hooks/useAuthSession";
import { getFriendlyError } from "../../src/presentation/errors/getFriendlyError";
import { mobileServices } from "../../src/presentation/services/mobileServices";
import { TrustSummaryCard } from "../../src/presentation/components/TrustSummaryCard";
import { colors, spacing, typography } from "../../src/theme/tokens";
import type { Shipment, Trip } from "../../src/types/models";

type CorridorMatch = {
  shipment: Shipment;
  trip: Trip;
};

function normalizeRoutePart(value: string): string {
  return value.trim().replace(/\s+/g, " ");
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
  const [shipments, setShipments] = useState<ReadonlyArray<Shipment>>([]);
  const [trips, setTrips] = useState<ReadonlyArray<Trip>>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [requestingMatch, setRequestingMatch] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

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
        mobileServices.shipment.watchActive(
          (nextShipments) => {
            setShipments(nextShipments);
            setShipmentsLoading(false);
          },
          (error) => {
            setDataError(getFriendlyError(error));
            setShipmentsLoading(false);
          },
        ),
      );
      unsubscribers.push(
        mobileServices.trip.watchActive(
          (nextTrips) => {
            setTrips(nextTrips);
            setTripsLoading(false);
          },
          (error) => {
            setDataError(getFriendlyError(error));
            setTripsLoading(false);
          },
        ),
      );
    } catch (error) {
      setDataError(getFriendlyError(error));
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

  async function handleRequestBooking(shipment: Shipment, trip: Trip) {
    if (!auth.user) {
      return;
    }

    const matchId = `${shipment.id}:${trip.id}`;
    setRequestingMatch(matchId);
    setRequestMessage(null);
    setRequestError(null);

    try {
      await mobileServices.booking.request({
        shipmentId: shipment.id,
        tripId: trip.id,
        senderId: auth.user.uid,
        travelerId: trip.ownerId,
      });
      setRequestMessage("Booking requested. The traveler has an in-app notification.");
    } catch (error) {
      setRequestError(getFriendlyError(error));
    } finally {
      setRequestingMatch(null);
    }
  }

  return (
    <Screen contentStyle={styles.page} withTabBar>
      <Card style={styles.hero} variant="soft">
        <View style={styles.heroTop}>
          <Badge label="Karri community" tone="primary" />
          <TrustBadge compact label="Trust-first" />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Move across borders with more clarity.</Text>
          <Text style={styles.heroBody}>
            Share what needs to move, publish where you&apos;re going, and see compatible
            community routes.
          </Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton onPress={() => router.push("/(tabs)/send")}>Create shipment</PrimaryButton>
          <PrimaryButton variant="secondary" onPress={() => router.push("/(tabs)/travel")}>
            Share a trip
          </PrimaryButton>
        </View>
      </Card>

      {!auth.loading && !auth.user ? (
        <View style={styles.section}>
          {auth.error ? (
            <Banner compact message={auth.error} title="Development setup" variant="development" />
          ) : null}
          <EmptyState
            action={<PrimaryButton onPress={() => router.push("/login")}>Get started</PrimaryButton>}
            description="Start a Karri session to view active community routes and possible matches."
            marker="M"
            title="Your matches will appear here"
          />
        </View>
      ) : null}

      {auth.user ? (
        <View style={styles.section}>
          <SectionHeader
            action={
              !isLoading && !dataError ? (
                <StatusChip label={`${matches.length} found`} tone="active" />
              ) : undefined
            }
            eyebrow="Suggested matches"
            subtitle="Exact origin and destination corridors from current active listings."
            title="Routes that line up"
          />

          {isLoading ? (
            <Card style={styles.loadingCard} variant="outlined">
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.mutedText}>Comparing active routes...</Text>
            </Card>
          ) : null}

          {!isLoading && dataError ? (
            <Banner message={dataError} title="Matches could not load" variant="error" />
          ) : null}

          {requestError ? (
            <Banner message={requestError} title="Booking request failed" variant="error" />
          ) : null}
          {requestMessage ? (
            <Banner message={requestMessage} title="Request sent" variant="success" />
          ) : null}

          {!isLoading && !dataError && matches.length === 0 ? (
            <EmptyState
              action={
                <PrimaryButton variant="secondary" onPress={() => router.push("/(tabs)/send")}>
                  Create a shipment
                </PrimaryButton>
              }
              description="An exact match appears when a shipment and trip share the same origin and destination cities and countries."
              marker="R"
              title="No route matches yet"
            />
          ) : null}

          {!isLoading && !dataError
            ? matches.map(({ shipment, trip }) => (
                <Card key={`${shipment.id}:${trip.id}`} variant="elevated">
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.cardTitle}>
                        {shipment.originCity} → {shipment.destinationCity}
                      </Text>
                      <Text style={styles.routeText}>
                        {shipment.originCountry} → {shipment.destinationCountry}
                      </Text>
                    </View>
                    <StatusChip label="Possible match" tone="info" />
                  </View>

                  <TrustBadge detail="Origin and destination align" label="Exact corridor" />

                  <View style={styles.detailsRow}>
                    <View style={styles.detailGroup}>
                      <Text style={styles.detailLabel}>Shipment</Text>
                      <Text style={styles.mutedText}>
                        {shipment.packageCategory} · {shipment.weightKg} kg
                      </Text>
                      <Text style={styles.mutedText}>
                        {shipment.rewardAmount} {shipment.rewardCurrency} reward
                      </Text>
                      <Text style={styles.mutedText}>Window: {shipment.deliveryWindow}</Text>
                    </View>
                    <View style={styles.detailGroup}>
                      <Text style={styles.detailLabel}>Trip</Text>
                      <Text style={styles.mutedText}>
                        {trip.departureDate} → {trip.arrivalDate}
                      </Text>
                      <Text style={styles.mutedText}>
                        {trip.availableCapacityKg} kg available
                      </Text>
                    </View>
                  </View>

                  <Banner
                    compact
                    message="Dates, weight, category, and participant eligibility still need human review."
                    title="Match scope"
                    variant="info"
                  />

                  <TrustSummaryCard compact title="Traveler trust" userId={trip.ownerId} />

                  {shipment.ownerId === auth.user?.uid && trip.ownerId !== auth.user?.uid ? (
                    <PrimaryButton
                      loading={requestingMatch === `${shipment.id}:${trip.id}`}
                      onPress={() => handleRequestBooking(shipment, trip)}
                    >
                      Request booking
                    </PrimaryButton>
                  ) : null}
                </Card>
              ))
            : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.xxl,
  },
  hero: {
    backgroundColor: colors.primarySoft,
    gap: spacing.lg,
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  heroCopy: {
    gap: spacing.sm,
  },
  heroTitle: {
    color: colors.text,
    ...typography.title,
  },
  heroBody: {
    color: colors.textSecondary,
    ...typography.body,
  },
  actions: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  loadingCard: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  cardTitleBlock: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 210,
  },
  cardTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  routeText: {
    color: colors.primary,
    ...typography.label,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
  },
  detailGroup: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 180,
  },
  detailLabel: {
    color: colors.text,
    ...typography.label,
  },
  mutedText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
