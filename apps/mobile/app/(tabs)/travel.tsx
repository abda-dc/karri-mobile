import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { DateSelector } from "../../src/components/DateSelector";
import { DashboardHeaderImage } from "../../src/components/DashboardHeaderImage";
import { EmptyState } from "../../src/components/EmptyState";
import { LoadingState } from "../../src/components/LoadingState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { RouteCardHeader } from "../../src/components/RouteCardHeader";
import {
  defaultOriginRoute,
  RouteSelector,
  type RouteSelection,
} from "../../src/components/RouteSelector";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StaleDataRetryBanner } from "../../src/components/StaleDataRetryBanner";
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
import { useProfile } from "../../src/presentation/hooks/useProfile";
import { reportFriendlyError } from "../../src/presentation/errors/getFriendlyError";
import { mobileServices } from "../../src/presentation/services/mobileServices";
import { TrustSummaryCard } from "../../src/presentation/components/TrustSummaryCard";
import { colors, radii, spacing, touchTargets, typography } from "../../src/theme/tokens";
import type { Trip } from "../../src/types/models";

const emptyForm = {
  originCountry: defaultOriginRoute.country,
  originCity: defaultOriginRoute.city,
  destinationCountry: "",
  destinationCity: "",
  departureDate: "",
  arrivalDate: "",
  availableCapacityKg: "5",
  notes: "",
};

type OpenDateSelector = "arrival" | "departure" | null;

const capacityPresets = [
  { label: "2 kg", description: "Small pouch", value: "2" },
  { label: "5 kg", description: "Carry-on space", value: "5" },
  { label: "10 kg", description: "Extra bag space", value: "10" },
  { label: "20 kg", description: "Checked-bag space", value: "20" },
];

type CapacitySelectorProps = {
  customValue: string;
  onCustomChange: (value: string) => void;
  onCustomSelect: () => void;
  onPresetSelect: (value: string) => void;
  selectedMode: "custom" | "preset";
  value: string;
};

type RecentRoute = {
  destination: RouteSelection;
  origin: RouteSelection;
};

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function CapacitySelector({
  customValue,
  onCustomChange,
  onCustomSelect,
  onPresetSelect,
  selectedMode,
  value,
}: CapacitySelectorProps) {
  return (
    <View style={styles.capacityField}>
      <Text style={styles.capacityLabel}>
        Available carrying capacity
        <Text style={styles.required}> *</Text>
      </Text>
      <View style={styles.capacityGrid}>
        {capacityPresets.map((preset) => {
          const selected = selectedMode === "preset" && preset.value === value;

          return (
            <Pressable
              accessibilityLabel={`${preset.label}: ${preset.description}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={preset.value}
              onPress={() => onPresetSelect(preset.value)}
              style={({ pressed }) => [
                styles.capacityOption,
                selected && styles.selectedCapacityOption,
                pressed && styles.pressedOption,
              ]}
            >
              <Text
                style={[
                  styles.capacityOptionLabel,
                  selected && styles.selectedCapacityOptionText,
                ]}
              >
                {preset.label}
              </Text>
              <Text
                style={[
                  styles.capacityOptionDescription,
                  selected && styles.selectedCapacityOptionText,
                ]}
              >
                {preset.description}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityLabel="Custom carrying capacity"
          accessibilityRole="button"
          accessibilityState={{ selected: selectedMode === "custom" }}
          onPress={onCustomSelect}
          style={({ pressed }) => [
            styles.capacityOption,
            selectedMode === "custom" && styles.selectedCapacityOption,
            pressed && styles.pressedOption,
          ]}
        >
          <Text
            style={[
              styles.capacityOptionLabel,
              selectedMode === "custom" && styles.selectedCapacityOptionText,
            ]}
          >
            Custom
          </Text>
          <Text
            style={[
              styles.capacityOptionDescription,
              selectedMode === "custom" && styles.selectedCapacityOptionText,
            ]}
          >
            Enter kg
          </Text>
        </Pressable>
      </View>
      {selectedMode === "custom" ? (
        <TextField
          keyboardType="decimal-pad"
          label="Custom capacity (kg)"
          onChangeText={onCustomChange}
          placeholder="8"
          value={customValue}
        />
      ) : null}
    </View>
  );
}

function TrustIndicator({ text }: { text: string }) {
  return (
    <View style={styles.trustIndicator}>
      <Text style={styles.trustIndicatorText}>{text}</Text>
    </View>
  );
}

export default function TravelScreen() {
  const auth = useAuthSession();
  const profileState = useProfile(auth.user?.uid ?? null);
  const [form, setForm] = useState(emptyForm);
  const [trips, setTrips] = useState<ReadonlyArray<Trip>>([]);
  const [listLoading, setListLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [listRetryKey, setListRetryKey] = useState(0);
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
  const [matchesRetryKey, setMatchesRetryKey] = useState(0);
  const [openDateSelector, setOpenDateSelector] = useState<OpenDateSelector>(null);
  const [capacityMode, setCapacityMode] = useState<"custom" | "preset">("preset");
  const [customCapacityValue, setCustomCapacityValue] = useState("");
  const [recentRoute, setRecentRoute] = useState<RecentRoute | null>(null);

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
  }, [auth.loading, auth.user, listRetryKey]);

  const activeTrips = useMemo(
    () => trips.filter((trip) => trip.status === "active"),
    [trips],
  );
  const showingStaleTrips = dataError !== null && trips.length > 0;
  const hasSessionMatchData = useMemo(
    () => Array.from(matchesByTrip.values()).some((matches) => matches.length > 0),
    [matchesByTrip],
  );
  const showingStaleMatches = matchesError !== null && hasSessionMatchData;
  const hasActiveProfile = profileState.profile?.status === "active";
  const needsProfile =
    Boolean(auth.user) &&
    !profileState.loading &&
    !profileState.error &&
    !hasActiveProfile;

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
          setMatchesError(reportFriendlyError(error, "travel.load-recommended-shipments"));
          setMatchesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTrips, auth.loading, auth.user, listLoading, matchFilters, matchesRetryKey]);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setSuccessMessage(null);
  }

  function updateRoute(prefix: "origin" | "destination", route: RouteSelection) {
    const next = {
      ...form,
      [`${prefix}Country`]: route.country,
      [`${prefix}City`]: route.city,
    };
    setForm(next);
    rememberRecentRoute(next);
    setFormError(null);
    setSuccessMessage(null);
  }

  function rememberRecentRoute(nextForm: typeof emptyForm) {
    if (
      nextForm.originCountry &&
      nextForm.originCity &&
      nextForm.destinationCountry &&
      nextForm.destinationCity
    ) {
      setRecentRoute({
        destination: {
          city: nextForm.destinationCity,
          country: nextForm.destinationCountry,
          subdivision: "",
        },
        origin: {
          city: nextForm.originCity,
          country: nextForm.originCountry,
          subdivision: "",
        },
      });
    }
  }

  function applyRecentRoute() {
    if (!recentRoute) {
      return;
    }

    setForm((current) => ({
      ...current,
      destinationCity: recentRoute.destination.city,
      destinationCountry: recentRoute.destination.country,
      originCity: recentRoute.origin.city,
      originCountry: recentRoute.origin.country,
    }));
    setFormError(null);
    setSuccessMessage(null);
  }

  function selectPresetCapacity(value: string) {
    setCapacityMode("preset");
    updateField("availableCapacityKg", value);
  }

  function selectCustomCapacity() {
    setCapacityMode("custom");
    updateField("availableCapacityKg", customCapacityValue);
  }

  function updateCustomCapacity(value: string) {
    setCapacityMode("custom");
    setCustomCapacityValue(value);
    updateField("availableCapacityKg", value);
  }

  async function handleCreateTrip() {
    if (!auth.user) {
      router.push("/login");
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

    if (profileState.loading) {
      setFormError("Karri is still checking your profile. Try publishing again in a moment.");
      return;
    }

    if (profileState.error) {
      setFormError("Profile status could not be confirmed. Retry profile status before publishing this trip.");
      return;
    }

    if (!hasActiveProfile) {
      setFormError("Complete your Karri profile before publishing this trip.");
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
      setCapacityMode("preset");
      setCustomCapacityValue("");
      setSuccessMessage("Trip published. It is now available for corridor matching.");
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

      <DashboardHeaderImage
        accessibilityLabel="Reliability starts early"
        aspectRatio={2172 / 724}
        source={require("../../assets/travel-trust-badge-icon.png")}
      />

      {auth.loading ? (
        <LoadingState message="Checking your Karri session..." />
      ) : null}

      <View style={styles.pageStack}>
          {!auth.loading && !auth.user ? (
            <Banner
              message="Sign in to post your trip and receive shipment matches. You can complete the form first."
              title="Continue as a guest"
              variant="info"
            />
          ) : null}
          {!auth.loading && !auth.user && auth.error ? (
            <Banner compact message={auth.error} title="Development setup" variant="development" />
          ) : null}
          {auth.user && profileState.loading ? (
            <LoadingState message="Checking your Karri profile..." />
          ) : null}
          {auth.user && profileState.error ? (
            <Card variant="outlined">
              <Banner
                message={profileState.error}
                title="Profile status could not load"
                variant="error"
              />
              <PrimaryButton
                accessibilityHint="Tries to load your Karri profile status again."
                variant="secondary"
                onPress={() => void profileState.refresh()}
              >
                Retry profile
              </PrimaryButton>
            </Card>
          ) : null}
          {needsProfile ? (
            <Card variant="outlined">
              <Banner
                message="You can complete this trip form now, but an active profile is required before publishing. Profile completion does not verify identity or automatically change your trust score."
                title="Complete your profile to publish"
                variant="info"
              />
              <PrimaryButton
                accessibilityHint="Opens profile setup so you can complete your Karri profile before publishing this trip."
                variant="secondary"
                onPress={() => router.push("/profile-setup")}
              >
                Complete profile
              </PrimaryButton>
            </Card>
          ) : null}
          <Card variant="elevated">
            <SectionHeader
              subtitle="Matches use the country and city values exactly."
              title="Route"
            />
            <RouteSelector
              label="Origin"
              onChange={(route) => updateRoute("origin", route)}
              value={{ country: form.originCountry, subdivision: "", city: form.originCity }}
            />
            <RouteSelector
              label="Destination"
              onChange={(route) => updateRoute("destination", route)}
              value={{ country: form.destinationCountry, subdivision: "", city: form.destinationCity }}
            />
            {recentRoute ? (
              <PrimaryButton onPress={applyRecentRoute} variant="secondary">
                Use last route
              </PrimaryButton>
            ) : null}
            <TrustIndicator text="Airport routes make matching easier for senders." />
          </Card>

          <Card variant="outlined">
            <SectionHeader
              subtitle="Use calendar dates and share only the capacity you are comfortable offering."
              title="Schedule and capacity"
            />
            <View style={styles.fieldRow}>
              <DateSelector
                containerStyle={styles.fieldColumn}
                expanded={openDateSelector === "departure"}
                helperText="Stored as YYYY-MM-DD."
                label="Departure date"
                onChange={(value) => updateField("departureDate", value)}
                onExpandedChange={(expanded) =>
                  setOpenDateSelector(expanded ? "departure" : null)
                }
                required
                value={form.departureDate}
              />
              <DateSelector
                containerStyle={styles.fieldColumn}
                expanded={openDateSelector === "arrival"}
                helperText="Stored as YYYY-MM-DD."
                label="Arrival date"
                minimumDate={form.departureDate || undefined}
                onChange={(value) => updateField("arrivalDate", value)}
                onExpandedChange={(expanded) =>
                  setOpenDateSelector(expanded ? "arrival" : null)
                }
                required
                value={form.arrivalDate}
              />
            </View>
            <CapacitySelector
              customValue={customCapacityValue}
              onCustomChange={updateCustomCapacity}
              onCustomSelect={selectCustomCapacity}
              onPresetSelect={selectPresetCapacity}
              selectedMode={capacityMode}
              value={form.availableCapacityKg}
            />
            <TrustIndicator text="Capacity helps avoid overpromising." />
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
              {saving ? "Publishing trip..." : "Publish trip"}
            </PrimaryButton>
          </Card>

          {auth.user ? <View style={styles.section}>
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
              <StaleDataRetryBanner
                message={
                  showingStaleTrips
                    ? `${dataError} Showing last loaded data from this session.`
                    : dataError
                }
                retryLabel="Retry trips"
                title="Trips could not load"
                variant={showingStaleTrips ? "warning" : "error"}
                onRetry={() => setListRetryKey((current) => current + 1)}
              />
            ) : null}

            {!listLoading && !dataError && trips.length === 0 ? (
              <EmptyState
                description="Post your route and available space so senders can find you."
                marker="T"
                title="Share your next trip"
              />
            ) : null}

            {!listLoading && (!dataError || showingStaleTrips)
              ? trips.map((trip) => (
                  <Card key={trip.id} variant="elevated">
                    <RouteCardHeader
                      destinationCity={trip.destinationCity}
                      destinationCountry={trip.destinationCountry}
                      originCity={trip.originCity}
                      originCountry={trip.originCountry}
                      status={trip.status}
                      statusTone={trip.status === "active" ? "active" : "neutral"}
                    />
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
          </View> : null}

          {!listLoading && (!dataError || showingStaleTrips) && activeTrips.length > 0 ? (
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
              {matchesError ? (
                <StaleDataRetryBanner
                  message={
                    showingStaleMatches
                      ? `${matchesError} Showing last loaded recommendations from this session.`
                      : matchesError
                  }
                  retryLabel="Retry recommendations"
                  title="Recommended shipments could not refresh"
                  variant={showingStaleMatches ? "warning" : "error"}
                  onRetry={() => setMatchesRetryKey((current) => current + 1)}
                />
              ) : null}
              {activeTrips.map((trip) => (
                <RecommendedMatchesSection
                  key={trip.id}
                  error={showingStaleMatches ? null : matchesError}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  trustIndicator: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primarySoft,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trustIndicatorText: {
    color: colors.primaryDark,
    ...typography.caption,
    fontWeight: "700",
  },
  capacityField: {
    gap: spacing.xs,
  },
  capacityLabel: {
    color: colors.text,
    ...typography.label,
  },
  required: {
    color: colors.error,
  },
  capacityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  capacityOption: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: 136,
    flexGrow: 1,
    gap: spacing.xxs,
    justifyContent: "center",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedCapacityOption: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  capacityOptionLabel: {
    color: colors.primaryDark,
    textAlign: "center",
    ...typography.label,
  },
  capacityOptionDescription: {
    color: colors.textSecondary,
    textAlign: "center",
    ...typography.caption,
  },
  selectedCapacityOptionText: {
    color: colors.primaryDark,
  },
  pressedOption: {
    opacity: 0.9,
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





