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
import { colors, spacing, typography } from "../../src/theme/tokens";
import type { Shipment } from "../../src/types/models";

const emptyForm = {
  originCountry: "",
  originCity: "",
  destinationCountry: "",
  destinationCity: "",
  packageCategory: "",
  packageDescription: "",
  weightKg: "",
  deliveryWindow: "",
  rewardAmount: "",
};

export default function SendScreen() {
  const auth = useAuthSession();
  const [form, setForm] = useState(emptyForm);
  const [shipments, setShipments] = useState<ReadonlyArray<Shipment>>([]);
  const [listLoading, setListLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [matchFilters, setMatchFilters] = useState<MatchDiscoveryFilters>(
    defaultMatchDiscoveryFilters,
  );
  const [matchesByShipment, setMatchesByShipment] = useState<
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
      setShipments([]);
      return;
    }

    setListLoading(true);
    setDataError(null);

    try {
      return mobileServices.shipment.watchOwned(
        auth.user.uid,
        (nextShipments) => {
          setShipments(nextShipments);
          setListLoading(false);
          setDataError(null);
        },
        (error) => {
          setDataError(reportFriendlyError(error, "send.watch-shipments"));
          setListLoading(false);
        },
      );
    } catch (error) {
      setDataError(reportFriendlyError(error, "send.start-shipment-watch"));
      setListLoading(false);
    }
  }, [auth.loading, auth.user]);

  const activeShipments = useMemo(
    () => shipments.filter((shipment) => shipment.status === "active"),
    [shipments],
  );

  useEffect(() => {
    if (auth.loading || listLoading) return;
    if (!auth.user || activeShipments.length === 0) {
      setMatchesByShipment(new Map());
      setMatchesLoading(false);
      setMatchesError(null);
      return;
    }

    let active = true;
    setMatchesLoading(true);
    setMatchesError(null);
    const category = matchFilters.packageCategory.trim();

    void mobileServices.matching
      .findMatchesForShipments(
        activeShipments.map((shipment) => shipment.id),
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
          setMatchesByShipment(matches);
          setMatchesLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setMatchesByShipment(new Map());
          setMatchesError(reportFriendlyError(error, "send.load-recommended-trips"));
          setMatchesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeShipments, auth.loading, auth.user, listLoading, matchFilters]);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setSuccessMessage(null);
  }

  async function handleCreateShipment() {
    if (!auth.user) {
      setFormError("Sign in before creating a shipment.");
      return;
    }

    const requiredText = [
      form.originCountry,
      form.originCity,
      form.destinationCountry,
      form.destinationCity,
      form.packageCategory,
      form.packageDescription,
      form.deliveryWindow,
    ];

    if (requiredText.some((value) => !value.trim())) {
      setFormError("Complete every shipment field before saving.");
      return;
    }

    const weightKg = Number(form.weightKg);
    const rewardAmount = Number(form.rewardAmount);

    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 100) {
      setFormError("Enter a weight greater than 0 and no more than 100 kg.");
      return;
    }

    if (!Number.isFinite(rewardAmount) || rewardAmount <= 0 || rewardAmount > 100000) {
      setFormError("Enter a reward greater than 0 and no more than 100,000 USD.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      await mobileServices.shipment.create({
        ownerId: auth.user.uid,
        originCountry: form.originCountry,
        originCity: form.originCity,
        destinationCountry: form.destinationCountry,
        destinationCity: form.destinationCity,
        packageCategory: form.packageCategory,
        packageDescription: form.packageDescription,
        weightKg,
        deliveryWindow: form.deliveryWindow,
        rewardAmount,
      });
      setForm(emptyForm);
      setSuccessMessage("Shipment saved. It is now available for corridor matching.");
    } catch (error) {
      setFormError(reportFriendlyError(error, "send.create-shipment"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen contentStyle={styles.page} withTabBar>
      <SectionHeader
        eyebrow="Send with Karri"
        subtitle="Share the route, package, timing, and reward a traveler needs to evaluate your request."
        title="Create a shipment"
      />

      <Image
        accessibilityLabel="Clarity builds trust"
        resizeMode="cover"
        source={require("../../assets/send-trust-badge-icon.png")}
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
            description="Start a Karri session before creating an owner-scoped shipment."
            marker="S"
            title="Sign in to create a shipment"
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
              subtitle="Describe only what a traveler needs to assess the package."
              title="Package details"
            />
            <TextField
              label="Package category"
              maxLength={80}
              onChangeText={(value) => updateField("packageCategory", value)}
              placeholder="Clothing, documents, personal care..."
              required
              value={form.packageCategory}
            />
            <TextField
              helperText="Do not include private recipient contact details."
              label="Package description"
              maxLength={500}
              multiline
              onChangeText={(value) => updateField("packageDescription", value)}
              placeholder="Describe what the traveler should expect"
              required
              value={form.packageDescription}
            />
            <TextField
              keyboardType="decimal-pad"
              label="Weight estimate (kg)"
              onChangeText={(value) => updateField("weightKg", value)}
              placeholder="2.5"
              required
              value={form.weightKg}
            />
          </Card>

          <Card variant="outlined">
            <SectionHeader
              subtitle="Set a practical window and a clear reward offer."
              title="Timing and reward"
            />
            <TextField
              label="Desired delivery window"
              maxLength={120}
              onChangeText={(value) => updateField("deliveryWindow", value)}
              placeholder="July 10–20, 2026"
              required
              value={form.deliveryWindow}
            />
            <TextField
              keyboardType="decimal-pad"
              label="Reward offer (USD)"
              onChangeText={(value) => updateField("rewardAmount", value)}
              placeholder="40"
              required
              value={form.rewardAmount}
            />

            {formError ? (
              <Banner message={formError} title="Review shipment details" variant="error" />
            ) : null}
            {successMessage ? (
              <Banner message={successMessage} title="Shipment ready" variant="success" />
            ) : null}

            <PrimaryButton loading={saving} onPress={handleCreateShipment}>
              {saving ? "Saving shipment..." : "Save shipment"}
            </PrimaryButton>
          </Card>

          <View style={styles.section}>
            <SectionHeader
              action={<StatusChip label={`${shipments.length} total`} tone="neutral" />}
              eyebrow="Your activity"
              subtitle="Your newest shipment requests appear first."
              title="Current shipments"
            />

            {listLoading ? (
              <LoadingState message="Loading your shipments..." />
            ) : null}

            {!listLoading && dataError ? (
              <Banner message={dataError} title="Shipments could not load" variant="error" />
            ) : null}

            {!listLoading && !dataError && shipments.length === 0 ? (
              <EmptyState
                description="Complete the form above and your saved shipment will appear here."
                marker="S"
                title="No shipments yet"
              />
            ) : null}

            {!listLoading && !dataError
              ? shipments.map((shipment) => (
                  <Card key={shipment.id} variant="elevated">
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleBlock}>
                        <Text style={styles.cardTitle}>
                          {shipment.originCity} → {shipment.destinationCity}
                        </Text>
                        <Text style={styles.routeText}>
                          {shipment.originCountry} → {shipment.destinationCountry}
                        </Text>
                      </View>
                      <StatusChip
                        label={shipment.status}
                        tone={shipment.status === "active" ? "active" : "neutral"}
                      />
                    </View>
                    <View style={styles.metaRow}>
                      <Badge label={shipment.packageCategory} tone="primary" />
                      <Badge label={`${shipment.weightKg} kg`} />
                      <Badge
                        label={`${shipment.rewardAmount} ${shipment.rewardCurrency}`}
                        tone="gold"
                      />
                    </View>
                    <Text style={styles.mutedText}>
                      Delivery window: {shipment.deliveryWindow}
                    </Text>
                    <Text style={styles.descriptionText}>{shipment.packageDescription}</Text>
                  </Card>
                ))
              : null}
          </View>

          {!listLoading && !dataError && activeShipments.length > 0 ? (
            <View style={styles.discoverySection}>
              <SectionHeader
                eyebrow="Discovery"
                subtitle="Ranked traveler trips for each active shipment, with the factors behind every score."
                title="Recommended travelers"
              />
              <MatchFiltersCard
                applying={matchesLoading}
                filters={matchFilters}
                onApply={setMatchFilters}
              />
              {activeShipments.map((shipment) => (
                <RecommendedMatchesSection
                  key={shipment.id}
                  error={matchesError}
                  filtered={hasActiveMatchFilters(matchFilters)}
                  loading={matchesLoading}
                  matches={matchesByShipment.get(shipment.id) ?? []}
                  recommendation="trip"
                  subject="shipment"
                  subtitle={`${shipment.packageCategory}, ${shipment.weightKg} kg - ${shipment.deliveryWindow}`}
                  title={`${shipment.originCity} to ${shipment.destinationCity}`}
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





