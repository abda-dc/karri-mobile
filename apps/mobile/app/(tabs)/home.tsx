import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { DashboardHeaderImage } from "../../src/components/DashboardHeaderImage";
import { EmptyState } from "../../src/components/EmptyState";
import { LoadingState } from "../../src/components/LoadingState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { RouteCardHeader } from "../../src/components/RouteCardHeader";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import { TrustBadge } from "../../src/components/TrustBadge";
import { useAuthSession } from "../../src/presentation/hooks/useAuthSession";
import { reportFriendlyError } from "../../src/presentation/errors/getFriendlyError";
import { mobileServices } from "../../src/presentation/services/mobileServices";
import { TrustSummaryCard } from "../../src/presentation/components/TrustSummaryCard";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";
import type { Shipment, Trip } from "../../src/types/models";

type CorridorMatch = {
  shipment: Shipment;
  trip: Trip;
};

type OptimisticRequestState = "confirmed" | "pending";

type HomeActionCardProps = {
  badgeLabel: string;
  buttonLabel?: string;
  description: string;
  onPress?: () => void;
  title: string;
};

function HomeActionCard({
  badgeLabel,
  buttonLabel,
  description,
  onPress,
  title,
}: HomeActionCardProps) {
  return (
    <View style={styles.actionCard}>
      <View style={styles.actionCardCopy}>
        <Badge label={badgeLabel} tone="primary" />
        <Text style={styles.actionCardTitle}>{title}</Text>
        <Text style={styles.actionCardDescription}>{description}</Text>
      </View>
      {buttonLabel ? (
        <PrimaryButton onPress={onPress} variant="secondary">
          {buttonLabel}
        </PrimaryButton>
      ) : null}
    </View>
  );
}

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
  const [optimisticRequests, setOptimisticRequests] = useState<
    ReadonlyMap<string, OptimisticRequestState>
  >(() => new Map());
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticRequests(new Map());
  }, [auth.user?.uid]);

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
            setDataError(reportFriendlyError(error, "home.watch-active-shipments"));
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
            setDataError(reportFriendlyError(error, "home.watch-active-trips"));
            setTripsLoading(false);
          },
        ),
      );
    } catch (error) {
      setDataError(reportFriendlyError(error, "home.start-listing-watches"));
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
    if (optimisticRequests.has(matchId)) {
      return;
    }

    setOptimisticRequests((current) => new Map(current).set(matchId, "pending"));
    setRequestMessage(null);
    setRequestError(null);

    try {
      await mobileServices.booking.request({
        shipmentId: shipment.id,
        tripId: trip.id,
        senderId: auth.user.uid,
        travelerId: trip.ownerId,
      });
      setOptimisticRequests((current) => new Map(current).set(matchId, "confirmed"));
      setRequestMessage("Booking requested. The traveler has an in-app notification.");
    } catch (error) {
      setOptimisticRequests((current) => {
        const next = new Map(current);
        next.delete(matchId);
        return next;
      });
      setRequestError(reportFriendlyError(error, "home.request-booking"));
    }
  }

  function renderBookingRequestAction(shipment: Shipment, trip: Trip) {
    if (
      !auth.user ||
      shipment.ownerId !== auth.user.uid ||
      trip.ownerId === auth.user.uid
    ) {
      return null;
    }

    const requestState = optimisticRequests.get(`${shipment.id}:${trip.id}`);

    if (requestState === "pending") {
      return (
        <Banner
          compact
          message="Karri is validating and syncing this request. It will roll back here if the write fails."
          title="Booking request pending"
          variant="warning"
        />
      );
    }

    if (requestState === "confirmed") {
      return (
        <Banner
          compact
          message="The request was confirmed. Tracking will show the canonical booking record."
          title="Booking request sent"
          variant="success"
        />
      );
    }

    return (
      <PrimaryButton onPress={() => handleRequestBooking(shipment, trip)}>
        Request booking
      </PrimaryButton>
    );
  }

  return (
    <Screen contentStyle={styles.page} withTabBar>
      <Card style={styles.hero} variant="soft">
        <DashboardHeaderImage
          accessibilityLabel="Karri community trust-first header"
          aspectRatio={1918 / 820}
          source={require("../../assets/home-trust-badge-icon.png")}
        />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Move across borders with more clarity.</Text>
          <Text style={styles.heroBody}>
            Share what needs to move, publish where you&apos;re going, and see compatible
            community routes.
          </Text>
        </View>
      </Card>

      <Card style={styles.actionArea} variant="elevated">
        <View style={styles.actionAreaHeader}>
          <Text style={styles.actionAreaTitle}>What do you want to do?</Text>
          <Text style={styles.actionAreaSubtitle}>
            Start with the path that matches your next step.
          </Text>
        </View>
        <View style={styles.actionList}>
          <HomeActionCard
            badgeLabel="1"
            buttonLabel="Start"
            description="Post a package route so travelers can review timing, weight, and reward."
            onPress={() => router.push("/(tabs)/send")}
            title="Send a Package"
          />
          <HomeActionCard
            badgeLabel="2"
            buttonLabel="Share trip"
            description="Share an upcoming trip and the spare capacity you are comfortable offering."
            onPress={() => router.push("/(tabs)/travel")}
            title="I’m Traveling"
          />
          <HomeActionCard
            badgeLabel="3"
            description="Suggested route matches appear below when active shipments and trips line up."
            title="Find Matches"
          />
          <HomeActionCard
            badgeLabel="4"
            buttonLabel="Open tracking"
            description="Check booking progress and shipment updates from your tracking view."
            onPress={() => router.push("/(tabs)/tracking")}
            title="Track Shipment"
          />
        </View>
      </Card>

      {!auth.loading && !auth.user ? (
        <View style={styles.section}>
          {auth.error ? (
            <Banner compact message={auth.error} title="Development setup" variant="development" />
          ) : null}
          <EmptyState
            action={<PrimaryButton onPress={() => router.push("/login")}>Get started</PrimaryButton>}
            description="Sign in to create shipments, share trips, and compare matches."
            marker="M"
            title="Start finding trusted routes"
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
            <LoadingState message="Comparing active routes..." />
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
              description="Create a shipment or share a trip so Karri can compare active routes."
              marker="R"
              title="No matching routes yet"
            />
          ) : null}

          {!isLoading && !dataError
            ? matches.map(({ shipment, trip }) => (
                <Card key={`${shipment.id}:${trip.id}`} variant="elevated">
                  <RouteCardHeader
                    destinationCity={shipment.destinationCity}
                    destinationCountry={shipment.destinationCountry}
                    originCity={shipment.originCity}
                    originCountry={shipment.originCountry}
                    status="Possible match"
                    statusTone="info"
                  />

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

                  {renderBookingRequestAction(shipment, trip)}
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
    gap: spacing.lg,
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
  actionArea: {
    gap: spacing.md,
  },
  actionAreaHeader: {
    gap: spacing.xxs,
  },
  actionAreaTitle: {
    color: colors.text,
    ...typography.headline,
  },
  actionAreaSubtitle: {
    color: colors.textSecondary,
    ...typography.body,
  },
  actionList: {
    gap: spacing.sm,
  },
  actionCard: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  actionCardCopy: {
    gap: spacing.sm,
  },
  actionCardTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  actionCardDescription: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  section: {
    gap: spacing.md,
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





