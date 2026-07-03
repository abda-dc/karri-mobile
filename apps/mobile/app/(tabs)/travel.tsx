import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { LoadingState } from "../../src/components/LoadingState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import { TextField } from "../../src/components/TextField";
import type { MatchResult } from "../../src/domain/matching/MatchResult";
import {
  defaultMatchDiscoveryFilters,
  hasActiveMatchFilters,
  MatchFiltersCard,
  type MatchDiscoveryFilters,
} from "../../src/presentation/components/MatchFiltersCard";
import { RecommendedMatchesSection } from "../../src/presentation/components/RecommendedMatchesSection";
import { useAuthSession } from "../../src/presentation/hooks/useAuthSession";
import { reportFriendlyError } from "../../src/presentation/errors/getFriendlyError";
import { mobileServices } from "../../src/presentation/services/mobileServices";
import { TrustSummaryCard } from "../../src/presentation/components/TrustSummaryCard";
import { colors, spacing, typography } from "../../src/theme/tokens";
import type { Trip } from "../../src/types/models";

const emptyForm = {
  originCountry: "",
  originCity: "",
  destinationCountry: "",
  destinationCity: "",
  departureDate: "",
  arrivalDate: "",
  availableCapacityKg: "",
  notes: "",
};

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function TravelScreen() {
  const auth = useAuthSession();
  const [form, setForm] = useState(emptyForm);
  const [trips, setTrips] = useState<ReadonlyArray<Trip>>([]);
  const [listLoading, setListLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [matchFilters, setMatchFilters] = useState<MatchDiscoveryFilters>(
    defaultMatchDiscoveryFilters,
  );
  const [matchesByTrip, setMatchesByTrip] = useState<
    ReadonlyMap<string, ReadonlyArray<MatchResult>>
  >(() => new Map());
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading) {
      return;
    }

    if (!auth.user) {
      setListLoading(false);
      setTrips([]);
      return;
    }

    setListLoading(true);
    setDataError(null);

    try {
      return mobileServices.trip.watchOwned(
        auth.user.uid,
        (nextTrips) => {
          setTrips(nextTrips);
          setListLoading(false);
          setDataError(null);
        },
        (error) => {
          setDataError(reportFriendlyError(error, "travel.watch-trips"));
          setListLoading(false);
        },
      );
    } catch (error) {
      setDataError(reportFriendlyError(error, "travel.start-trip-watch"));
      setListLoading(false);
    }
  }, [auth.loading, auth.user]);

  const activeTrips = useMemo(
    () => trips.filter((trip) => trip.status === "active"),
    [trips],
  );

  useEffect(() => {
    if (auth.loading || listLoading) return;
    if (!auth.user || activeTrips.length === 0) {
      setMatchesByTrip(new Map());
      setMatchesLoading(false);
      setMatchesError(null);
      return;
    }

    let active = true;
    setMatchesLoading(true);
    setMatchesError(null);
    const category = matchFilters.packageCategory.trim();

    void mobileServices.matching
      .findMatchesForTrips(
        activeTrips.map((trip) => trip.id),
        {
          allowedPackageCategories: category ? [category] : [],
          eligibleOnly: matchFilters.eligibleOnly,
          maximumResults: matchFilters.maximumResults,
          minimumScore: matchFilters.minimumScore,
          requireIdentityVerification: matchFilters.verifiedOnly,
          requirePackageCompatibility: Boolean(category),
          viewerId: auth.user.uid,
        },
      )
      .then((matches) => {
        if (active) {
          setMatchesByTrip(matches);
          setMatchesLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setMatchesByTrip(new Map());
          setMatchesError(reportFriendlyError(error, "travel.load-recommended-shipments"));
          setMatchesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTrips, auth.loading, auth.user, listLoading, matchFilters]);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setSuccessMessage(null);
  }

  async function handleCreateTrip() {
    if (!auth.user) {
      setFormError("Sign in before creating a trip.");
      return;
    }

    const requiredText = [
      form.originCountry,
      form.originCity,
      form.destinationCountry,
      form.destinationCity,
      form.departureDate,
      form.arrivalDate,
    ];

    if (requiredText.some((value) => !value.trim())) {
      setFormError("Complete every required trip field before saving.");
      return;
    }

    if (!isValidDateInput(form.departureDate) || !isValidDateInput(form.arrivalDate)) {
      setFormError("Enter both dates in valid YYYY-MM-DD format.");
      return;
    }

    if (form.arrivalDate < form.departureDate) {
      setFormError("Arrival date cannot be earlier than departure date.");
      return;
    }

    const availableCapacityKg = Number(form.availableCapacityKg);

    if (
      !Number.isFinite(availableCapacityKg) ||
      availableCapacityKg <= 0 ||
      availableCapacityKg > 100
    ) {
      setFormError("Enter capacity greater than 0 and no more than 100 kg.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      await mobileServices.trip.create({
        ownerId: auth.user.uid,
        originCountry: form.originCountry,
        originCity: form.originCity,
        destinationCountry: form.destinationCountry,
        destinationCity: form.destinationCity,
        departureDate: form.departureDate,
        arrivalDate: form.arrivalDate,
        availableCapacityKg,
        notes: form.notes,
      });
      setForm(emptyForm);
      setSuccessMessage("Trip saved. It is now available for corridor matching.");
    } catch (error) {
      setFormError(reportFriendlyError(error, "travel.create-trip"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen contentStyle={styles.page} withTabBar>
      <SectionHeader
        eyebrow="Travel with Karri"
        subtitle="Share your route, dates, and spare capacity so senders can understand the opportunity."
        title="Create a trip"
      />

      <Image
        accessibilityLabel="Reliability starts early"
        resizeMode="cover"
        source={require("../../assets/travel-trust-badge-icon.png")}
        style={styles.dashboardHeaderImage}
      />

      {auth.loading ? (
        <LoadingState message="Checking your Karri session..." />
      ) : null}

      {!auth.loading && !auth.user ? (
        <View style={styles.section}>
          {auth.error ? (
            <Banner compact message={auth.error} title="Development setup" variant="development" />
          ) : null}
          <EmptyState
            action={<PrimaryButton onPress={() => router.push("/login")}>Get started</PrimaryButton>}
            description="Start a Karri session before creating an owner-scoped trip."
            marker="T"
            title="Sign in to share a trip"
          />
        </View>
      ) : null}

      {auth.user ? (
        <View style={styles.pageStack}>
          <Card variant="elevated">
            <SectionHeader
              subtitle="Matches use the country and city values exactly."
              title="Route"
            />
            <View style={styles.fieldRow}>
              <TextField
                containerStyle={styles.fieldColumn}
                label="Origin country"
                maxLength={80}
                onChangeText={(value) => updateField("originCountry", value)}
                placeholder="United States"
                required
                value={form.originCountry}
              />
              <TextField
                containerStyle={styles.fieldColumn}
                label="Origin city"
                maxLength={120}
                onChangeText={(value) => updateField("originCity", value)}
                placeholder="Washington, DC"
                required
                value={form.originCity}
              />
            </View>
            <View style={styles.fieldRow}>
              <TextField
                containerStyle={styles.fieldColumn}
                label="Destination country"
                maxLength={80}
                onChangeText={(value) => updateField("destinationCountry", value)}
                placeholder="Kenya"
                required
                value={form.destinationCountry}
              />
              <TextField
                containerStyle={styles.fieldColumn}
                label="Destination city"
                maxLength={120}
                onChangeText={(value) => updateField("destinationCity", value)}
                placeholder="Nairobi"
                required
                value={form.destinationCity}
              />
            </View>
          </Card>

          <Card variant="outlined">
            <SectionHeader
              subtitle="Use calendar dates and share only the capacity you are comfortable offering."
              title="Schedule and capacity"
            />
            <View style={styles.fieldRow}>
              <TextField
                containerStyle={styles.fieldColumn}
                helperText="Use YYYY-MM-DD."
                label="Departure date"
                maxLength={10}
                onChangeText={(value) => updateField("departureDate", value)}
                placeholder="2026-07-10"
                required
                value={form.departureDate}
              />
              <TextField
                containerStyle={styles.fieldColumn}
                helperText="Use YYYY-MM-DD."
                label="Arrival date"
                maxLength={10}
                onChangeText={(value) => updateField("arrivalDate", value)}
                placeholder="2026-07-11"
                required
                value={form.arrivalDate}
              />
            </View>
            <TextField
              keyboardType="decimal-pad"
              label="Available luggage capacity (kg)"
              onChangeText={(value) => updateField("availableCapacityKg", value)}
              placeholder="8"
              required
              value={form.availableCapacityKg}
            />
            <TextField
              helperText="Do not add private contact or travel-document details."
              label="Notes (optional)"
              maxLength={500}
              multiline
              onChangeText={(value) => updateField("notes", value)}
              placeholder="Handoff availability or package preferences"
              value={form.notes}
            />

            {formError ? (
              <Banner message={formError} title="Review trip details" variant="error" />
            ) : null}
            {successMessage ? (
              <Banner message={successMessage} title="Trip ready" variant="success" />
            ) : null}

            <PrimaryButton loading={saving} onPress={handleCreateTrip}>
              {saving ? "Saving trip..." : "Save trip"}
            </PrimaryButton>
          </Card>

          <View style={styles.section}>
            <SectionHeader
              action={<StatusChip label={`${trips.length} total`} tone="neutral" />}
              eyebrow="Your activity"
              subtitle="Your newest travel routes appear first."
              title="Current trips"
            />

            {listLoading ? (
              <LoadingState message="Loading your trips..." />
            ) : null}

            {!listLoading && dataError ? (
              <Banner message={dataError} title="Trips could not load" variant="error" />
            ) : null}

            {!listLoading && !dataError && trips.length === 0 ? (
              <EmptyState
                description="Complete the form above and your saved trip will appear here."
                marker="T"
                title="No trips yet"
              />
            ) : null}

            {!listLoading && !dataError
              ? trips.map((trip) => (
                  <Card key={trip.id} variant="elevated">
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleBlock}>
                        <Text style={styles.cardTitle}>
                          {trip.originCity} → {trip.destinationCity}
                        </Text>
                        <Text style={styles.routeText}>
                          {trip.originCountry} → {trip.destinationCountry}
                        </Text>
                      </View>
                      <StatusChip
                        label={trip.status}
                        tone={trip.status === "active" ? "active" : "neutral"}
                      />
                    </View>
                    <View style={styles.metaRow}>
                      <Badge label={trip.departureDate} tone="info" />
                      <Badge label={`${trip.availableCapacityKg} kg available`} tone="primary" />
                    </View>
                    <Text style={styles.mutedText}>Arrives {trip.arrivalDate}</Text>
                    {trip.notes ? <Text style={styles.descriptionText}>{trip.notes}</Text> : null}
                    <TrustSummaryCard
                      accountCreatedAt={auth.user?.createdAt}
                      compact
                      title="Traveler trust"
                      userId={trip.ownerId}
                    />
                  </Card>
                ))
              : null}
          </View>

          {!listLoading && !dataError && activeTrips.length > 0 ? (
            <View style={styles.discoverySection}>
              <SectionHeader
                eyebrow="Discovery"
                subtitle="Ranked shipments for each active trip, with the factors behind every score."
                title="Recommended shipments"
              />
              <MatchFiltersCard
                applying={matchesLoading}
                filters={matchFilters}
                onApply={setMatchFilters}
              />
              {activeTrips.map((trip) => (
                <RecommendedMatchesSection
                  key={trip.id}
                  error={matchesError}
                  filtered={hasActiveMatchFilters(matchFilters)}
                  loading={matchesLoading}
                  matches={matchesByTrip.get(trip.id) ?? []}
                  recommendation="shipment"
                  subject="trip"
                  subtitle={`${trip.departureDate} to ${trip.arrivalDate} - ${trip.availableCapacityKg} kg capacity`}
                  title={`${trip.originCity} to ${trip.destinationCity}`}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dashboardHeaderImage: {
    alignSelf: "stretch",
    borderRadius: 28,
    height: 180,
    overflow: "hidden",
    width: "100%",
  },
  page: {
    gap: spacing.xl,
  },
  pageStack: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  discoverySection: {
    gap: spacing.xl,
  },
  fieldRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  fieldColumn: {
    flexBasis: 200,
    flexGrow: 1,
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
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  descriptionText: {
    color: colors.text,
    ...typography.body,
  },
  mutedText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});





