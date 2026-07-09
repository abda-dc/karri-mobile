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
import { colors, radii, spacing, touchTargets, typography } from "../../src/theme/tokens";
import type { Shipment } from "../../src/types/models";

const emptyForm = {
  originCountry: defaultOriginRoute.country,
  originCity: defaultOriginRoute.city,
  destinationCountry: "",
  destinationCity: "",
  packageCategory: "",
  packageDescription: "",
  weightKg: "",
  deliveryWindow: "",
  deliveryWindowEnd: "",
  deliveryWindowStart: "",
  rewardAmount: "",
};

type OpenDateSelector = "deliveryEnd" | "deliveryStart" | null;
type WeightUnit = "kg" | "lb";

const packageCategories = [
  "Documents",
  "Clothing",
  "Electronics",
  "Medicine",
  "Food items",
  "Other",
];

const weightPresets = [
  { label: "1 kg", value: "1" },
  { label: "2 kg", value: "2" },
  { label: "5 kg", value: "5" },
  { label: "10 kg", value: "10" },
];

const poundsToKilograms = 0.45359237;

type PackageCategoryPickerProps = {
  onChange: (value: string) => void;
  value: string;
};

type WeightSelectorProps = {
  customInput: string;
  onCustomInputChange: (value: string) => void;
  onCustomSelect: () => void;
  onPresetSelect: (value: string) => void;
  onUnitChange: (unit: WeightUnit) => void;
  selectedMode: "custom" | "preset";
  unit: WeightUnit;
  value: string;
};

type RewardSuggestion = {
  applyValue: string;
  high: number;
  low: number;
};

type RewardSuggestionHelperProps = {
  onApply: (value: string) => void;
  suggestion: RewardSuggestion | null;
};

type ValidatedShipmentValues = {
  rewardAmount: number;
  weightKg: number;
};

type ShipmentReviewPanelProps = {
  form: typeof emptyForm;
  onEdit: () => void;
  onPost: () => void;
  saving: boolean;
};

type DraftShipmentCardProps = {
  draft: typeof emptyForm | null;
  onClear: () => void;
  onRestore: () => void;
  onSave: () => void;
};

type RecentRoute = {
  destination: RouteSelection;
  origin: RouteSelection;
};

function PackageCategoryPicker({ onChange, value }: PackageCategoryPickerProps) {
  return (
    <View style={styles.categoryField}>
      <Text style={styles.categoryLabel}>
        Package category
        <Text style={styles.required}> *</Text>
      </Text>
      <View style={styles.categoryGrid}>
        {packageCategories.map((category) => {
          const selected = category === value;

          return (
            <Pressable
              accessibilityLabel={`Package category: ${category}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={category}
              onPress={() => onChange(category)}
              style={({ pressed }) => [
                styles.categoryOption,
                selected && styles.selectedCategoryOption,
                pressed && styles.pressedCategoryOption,
              ]}
            >
              <Text
                style={[
                  styles.categoryOptionText,
                  selected && styles.selectedCategoryOptionText,
                ]}
              >
                {category}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DraftShipmentCard({ draft, onClear, onRestore, onSave }: DraftShipmentCardProps) {
  return (
    <View style={styles.draftCard}>
      <View style={styles.draftHeader}>
        <View style={styles.draftHeaderText}>
          <Text style={styles.draftEyebrow}>Local draft</Text>
          <Text style={styles.draftTitle}>
            {draft ? "Draft saved on this device" : "Save this shipment for later"}
          </Text>
        </View>
        {draft ? <Badge label="Unsynced" tone="neutral" /> : null}
      </View>

      {draft ? (
        <View style={styles.draftSummary}>
          <Text style={styles.draftRoute}>
            {draft.originCity || "Origin"} to {draft.destinationCity || "Destination"}
          </Text>
          <Text style={styles.draftMeta}>
            {[draft.packageCategory, draft.weightKg ? `${draft.weightKg} kg` : "", draft.rewardAmount ? `$${draft.rewardAmount}` : ""]
              .filter(Boolean)
              .join(" - ") || "Draft details are still in progress."}
          </Text>
          {draft.deliveryWindow ? (
            <Text style={styles.draftMeta}>{draft.deliveryWindow}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.draftMeta}>
          Drafts stay local for now and do not post a shipment.
        </Text>
      )}

      <View style={styles.draftActions}>
        <PrimaryButton onPress={onSave} variant="secondary">
          Save draft
        </PrimaryButton>
        {draft ? (
          <>
            <PrimaryButton onPress={onRestore} variant="secondary">
              Restore
            </PrimaryButton>
            <PrimaryButton onPress={onClear} variant="ghost">
              Clear
            </PrimaryButton>
          </>
        ) : null}
      </View>
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

function ShipmentReviewPanel({ form, onEdit, onPost, saving }: ShipmentReviewPanelProps) {
  return (
    <View style={styles.reviewPanel}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewHeaderText}>
          <Text style={styles.reviewEyebrow}>Review shipment</Text>
          <Text style={styles.reviewTitle}>Ready to post?</Text>
        </View>
        <Badge label={form.packageCategory} tone="primary" />
      </View>

      <View style={styles.reviewRoute}>
        <Text style={styles.reviewRouteCity}>
          {form.originCity}, {form.originCountry}
        </Text>
        <Text style={styles.reviewRouteArrow}>to</Text>
        <Text style={styles.reviewRouteDestination}>
          {form.destinationCity}, {form.destinationCountry}
        </Text>
      </View>

      <View style={styles.reviewGrid}>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Weight</Text>
          <Text style={styles.reviewValue}>{form.weightKg} kg</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Reward</Text>
          <Text style={styles.reviewValue}>${form.rewardAmount} USD</Text>
        </View>
        <View style={styles.reviewItemWide}>
          <Text style={styles.reviewLabel}>Delivery window</Text>
          <Text style={styles.reviewValue}>{form.deliveryWindow}</Text>
        </View>
      </View>

      <View style={styles.reviewDescription}>
        <Text style={styles.reviewLabel}>Package description</Text>
        <Text style={styles.descriptionText}>{form.packageDescription}</Text>
      </View>

      <View style={styles.reviewActions}>
        <PrimaryButton disabled={saving} onPress={onEdit} variant="secondary">
          Edit details
        </PrimaryButton>
        <PrimaryButton loading={saving} onPress={onPost}>
          {saving ? "Posting..." : "Post shipment"}
        </PrimaryButton>
      </View>
    </View>
  );
}

function calculateDeliveryWindowDays(start: string, end: string): number | null {
  const startParts = start.split("-").map(Number);
  const endParts = end.split("-").map(Number);

  if (
    startParts.length !== 3 ||
    endParts.length !== 3 ||
    startParts.some((part) => !Number.isFinite(part)) ||
    endParts.some((part) => !Number.isFinite(part))
  ) {
    return null;
  }

  const startDate = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
  const endDate = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((endDate - startDate) / dayMs) + 1;
}

function roundReward(value: number): number {
  return Math.max(5, Math.round(value));
}

function getRewardSuggestion(
  packageCategory: string,
  weightKg: string,
  deliveryWindowStart: string,
  deliveryWindowEnd: string,
): RewardSuggestion | null {
  const weight = Number(weightKg);

  if (!Number.isFinite(weight) || weight <= 0) {
    return null;
  }

  let low = 10;
  let high = 18;

  if (weight > 10) {
    low = 60;
    high = 90;
  } else if (weight > 5) {
    low = 40;
    high = 65;
  } else if (weight > 2) {
    low = 25;
    high = 40;
  } else if (weight > 1) {
    low = 15;
    high = 25;
  }

  if (packageCategory === "Electronics") {
    low += 8;
    high += 8;
  } else if (packageCategory === "Medicine") {
    low += 6;
    high += 6;
  }

  const deliveryDays = calculateDeliveryWindowDays(deliveryWindowStart, deliveryWindowEnd);
  if (deliveryDays !== null) {
    if (deliveryDays <= 1) {
      low += 5;
      high += 5;
    } else if (deliveryDays >= 5) {
      low -= 5;
      high -= 5;
    }
  }

  const roundedLow = roundReward(low);
  const roundedHigh = Math.max(roundedLow + 5, roundReward(high));

  return {
    applyValue: String(Math.round((roundedLow + roundedHigh) / 2)),
    high: roundedHigh,
    low: roundedLow,
  };
}

function RewardSuggestionHelper({ onApply, suggestion }: RewardSuggestionHelperProps) {
  if (!suggestion) {
    return (
      <View style={styles.rewardSuggestion}>
        <Text style={styles.rewardSuggestionEyebrow}>Suggested starting point</Text>
        <Text style={styles.rewardSuggestionMuted}>
          Add package weight to see a simple reward range.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.rewardSuggestion}>
      <View style={styles.rewardSuggestionContent}>
        <Text style={styles.rewardSuggestionEyebrow}>Suggested starting point</Text>
        <Text style={styles.rewardSuggestionRange}>
          ${suggestion.low}-${suggestion.high}
        </Text>
        <Text style={styles.rewardSuggestionMuted}>
          Based on weight, package type, and delivery flexibility.
        </Text>
      </View>
      <Pressable
        accessibilityLabel={`Apply suggested reward of ${suggestion.applyValue} dollars`}
        accessibilityRole="button"
        onPress={() => onApply(suggestion.applyValue)}
        style={({ pressed }) => [
          styles.rewardApplyButton,
          pressed && styles.pressedCategoryOption,
        ]}
      >
        <Text style={styles.rewardApplyButtonText}>Apply ${suggestion.applyValue}</Text>
      </Pressable>
    </View>
  );
}

function convertWeightToKilograms(input: string, unit: WeightUnit): string {
  const numericValue = Number(input);
  if (!input.trim() || !Number.isFinite(numericValue) || numericValue <= 0) {
    return "";
  }

  if (unit === "kg") {
    return input;
  }

  return (numericValue * poundsToKilograms).toFixed(2);
}

function formatWeightConversion(input: string, unit: WeightUnit): string | undefined {
  if (unit !== "lb") {
    return undefined;
  }

  const numericValue = Number(input);
  if (!input.trim() || !Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }

  return `${input} lb ≈ ${(numericValue * poundsToKilograms).toFixed(2)} kg`;
}

function WeightSelector({
  customInput,
  onCustomInputChange,
  onCustomSelect,
  onPresetSelect,
  onUnitChange,
  selectedMode,
  unit,
  value,
}: WeightSelectorProps) {
  const helperText = formatWeightConversion(customInput, unit);

  return (
    <View style={styles.weightField}>
      <Text style={styles.weightLabel}>
        Weight estimate
        <Text style={styles.required}> *</Text>
      </Text>
      <View style={styles.weightOptionGrid}>
        {weightPresets.map((preset) => {
          const selected = selectedMode === "preset" && preset.value === value;

          return (
            <Pressable
              accessibilityLabel={`Weight estimate: ${preset.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={preset.value}
              onPress={() => onPresetSelect(preset.value)}
              style={({ pressed }) => [
                styles.weightOption,
                selected && styles.selectedWeightOption,
                pressed && styles.pressedCategoryOption,
              ]}
            >
              <Text
                style={[
                  styles.weightOptionText,
                  selected && styles.selectedWeightOptionText,
                ]}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityLabel="Weight estimate: Custom"
          accessibilityRole="button"
          accessibilityState={{ selected: selectedMode === "custom" }}
          onPress={onCustomSelect}
          style={({ pressed }) => [
            styles.weightOption,
            selectedMode === "custom" && styles.selectedWeightOption,
            pressed && styles.pressedCategoryOption,
          ]}
        >
          <Text
            style={[
              styles.weightOptionText,
              selectedMode === "custom" && styles.selectedWeightOptionText,
            ]}
          >
            Custom
          </Text>
        </Pressable>
      </View>
      {selectedMode === "custom" ? (
        <View style={styles.customWeight}>
          <TextField
            helperText={helperText}
            keyboardType="decimal-pad"
            label="Custom weight"
            onChangeText={onCustomInputChange}
            placeholder={unit === "kg" ? "2.5" : "10"}
            value={customInput}
          />
          <View style={styles.unitToggle}>
            {(["kg", "lb"] as const).map((unitOption) => {
              const selected = unitOption === unit;

              return (
                <Pressable
                  accessibilityLabel={`Weight unit: ${unitOption}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={unitOption}
                  onPress={() => onUnitChange(unitOption)}
                  style={({ pressed }) => [
                    styles.unitOption,
                    selected && styles.selectedUnitOption,
                    pressed && styles.pressedCategoryOption,
                  ]}
                >
                  <Text
                    style={[
                      styles.unitOptionText,
                      selected && styles.selectedUnitOptionText,
                    ]}
                  >
                    {unitOption}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

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
  const [openDateSelector, setOpenDateSelector] = useState<OpenDateSelector>(null);
  const [weightMode, setWeightMode] = useState<"custom" | "preset">("preset");
  const [customWeightInput, setCustomWeightInput] = useState("");
  const [customWeightUnit, setCustomWeightUnit] = useState<WeightUnit>("kg");
  const [reviewingShipment, setReviewingShipment] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState<typeof emptyForm | null>(null);
  const [recentRoute, setRecentRoute] = useState<RecentRoute | null>(null);

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
  const rewardSuggestion = useMemo(
    () =>
      getRewardSuggestion(
        form.packageCategory,
        form.weightKg,
        form.deliveryWindowStart,
        form.deliveryWindowEnd,
      ),
    [
      form.deliveryWindowEnd,
      form.deliveryWindowStart,
      form.packageCategory,
      form.weightKg,
    ],
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
    setReviewingShipment(false);
  }

  function updateDeliveryWindow(field: "deliveryWindowEnd" | "deliveryWindowStart", value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      const start = next.deliveryWindowStart;
      const end = next.deliveryWindowEnd;
      return {
        ...next,
        deliveryWindow: start && end ? `${start} to ${end}` : "",
      };
    });
    setFormError(null);
    setSuccessMessage(null);
    setReviewingShipment(false);
  }

  function selectPresetWeight(value: string) {
    setWeightMode("preset");
    updateField("weightKg", value);
  }

  function selectCustomWeight() {
    setWeightMode("custom");
    updateField("weightKg", convertWeightToKilograms(customWeightInput, customWeightUnit));
  }

  function updateCustomWeightInput(value: string) {
    setWeightMode("custom");
    setCustomWeightInput(value);
    updateField("weightKg", convertWeightToKilograms(value, customWeightUnit));
  }

  function updateCustomWeightUnit(unit: WeightUnit) {
    setWeightMode("custom");
    setCustomWeightUnit(unit);
    updateField("weightKg", convertWeightToKilograms(customWeightInput, unit));
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
    setReviewingShipment(false);
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
    setReviewingShipment(false);
  }

  function saveShipmentDraft() {
    setShipmentDraft({ ...form });
    setFormError(null);
    setSuccessMessage(null);
    setReviewingShipment(false);
  }

  function restoreShipmentDraft() {
    if (!shipmentDraft) {
      return;
    }

    setForm({ ...shipmentDraft });
    setFormError(null);
    setSuccessMessage(null);
    setReviewingShipment(false);
  }

  function clearShipmentDraft() {
    setShipmentDraft(null);
    setFormError(null);
    setSuccessMessage(null);
    setReviewingShipment(false);
  }

  function validateShipmentForm(): ValidatedShipmentValues | null {
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
      return null;
    }

    if (form.deliveryWindowEnd < form.deliveryWindowStart) {
      setFormError("Delivery window end cannot be before the start date.");
      return null;
    }

    const weightKg = Number(form.weightKg);
    const rewardAmount = Number(form.rewardAmount);

    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 100) {
      setFormError("Enter a weight greater than 0 and no more than 100 kg.");
      return null;
    }

    if (!Number.isFinite(rewardAmount) || rewardAmount <= 0 || rewardAmount > 100000) {
      setFormError("Enter a reward greater than 0 and no more than 100,000 USD.");
      return null;
    }

    return { rewardAmount, weightKg };
  }

  function handleReviewShipment() {
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const validated = validateShipmentForm();
    if (!validated) {
      setReviewingShipment(false);
      return;
    }

    setFormError(null);
    setSuccessMessage(null);
    setReviewingShipment(true);
  }

  async function handleCreateShipment() {
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const validated = validateShipmentForm();
    if (!validated) {
      setReviewingShipment(false);
      return;
    }

    const { rewardAmount, weightKg } = validated;

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
      setWeightMode("preset");
      setCustomWeightInput("");
      setCustomWeightUnit("kg");
      setReviewingShipment(false);
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

      <DashboardHeaderImage
        accessibilityLabel="Clarity builds trust"
        aspectRatio={2172 / 724}
        source={require("../../assets/send-trust-badge-icon.png")}
      />

      {auth.loading ? (
        <LoadingState message="Checking your Karri session..." />
      ) : null}

      <View style={styles.pageStack}>
          {!auth.loading && !auth.user ? (
            <Banner
              message="Sign in to post your shipment and receive traveler matches. You can complete the form first."
              title="Continue as a guest"
              variant="info"
            />
          ) : null}
          {!auth.loading && !auth.user && auth.error ? (
            <Banner compact message={auth.error} title="Development setup" variant="development" />
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
            <TrustIndicator text="Use airports for clearer handoff planning." />
          </Card>

          <Card variant="outlined">
            <SectionHeader
              subtitle="Describe only what a traveler needs to assess the package."
              title="Package details"
            />
            <PackageCategoryPicker
              onChange={(value) => updateField("packageCategory", value)}
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
            <WeightSelector
              customInput={customWeightInput}
              onCustomInputChange={updateCustomWeightInput}
              onCustomSelect={selectCustomWeight}
              onPresetSelect={selectPresetWeight}
              onUnitChange={updateCustomWeightUnit}
              selectedMode={weightMode}
              unit={customWeightUnit}
              value={form.weightKg}
            />
            <TrustIndicator text="Keep package sealed until a traveler accepts." />
          </Card>

          <Card variant="outlined">
            <SectionHeader
              subtitle="Set a practical window and a clear reward offer."
              title="Timing and reward"
            />
            <View style={styles.fieldRow}>
              <DateSelector
                containerStyle={styles.fieldColumn}
                expanded={openDateSelector === "deliveryStart"}
                helperText="First day the package can arrive."
                label="Delivery start"
                onChange={(value) => updateDeliveryWindow("deliveryWindowStart", value)}
                onExpandedChange={(expanded) =>
                  setOpenDateSelector(expanded ? "deliveryStart" : null)
                }
                required
                value={form.deliveryWindowStart}
              />
              <DateSelector
                containerStyle={styles.fieldColumn}
                expanded={openDateSelector === "deliveryEnd"}
                helperText="Last day the package can arrive."
                label="Delivery end"
                minimumDate={form.deliveryWindowStart || undefined}
                onChange={(value) => updateDeliveryWindow("deliveryWindowEnd", value)}
                onExpandedChange={(expanded) =>
                  setOpenDateSelector(expanded ? "deliveryEnd" : null)
                }
                required
                value={form.deliveryWindowEnd}
              />
            </View>
            <TextField
              keyboardType="decimal-pad"
              label="Reward offer (USD)"
              onChangeText={(value) => updateField("rewardAmount", value)}
              placeholder={rewardSuggestion?.applyValue ?? "40"}
              required
              value={form.rewardAmount}
            />
            <RewardSuggestionHelper
              onApply={(value) => updateField("rewardAmount", value)}
              suggestion={rewardSuggestion}
            />
            <DraftShipmentCard
              draft={shipmentDraft}
              onClear={clearShipmentDraft}
              onRestore={restoreShipmentDraft}
              onSave={saveShipmentDraft}
            />
            <TrustIndicator text="Review details before posting." />
            {reviewingShipment ? (
              <ShipmentReviewPanel
                form={form}
                onEdit={() => setReviewingShipment(false)}
                onPost={handleCreateShipment}
                saving={saving}
              />
            ) : null}

            {formError ? (
              <Banner message={formError} title="Review shipment details" variant="error" />
            ) : null}
            {successMessage ? (
              <Banner message={successMessage} title="Shipment ready" variant="success" />
            ) : null}

            {!reviewingShipment ? (
              <PrimaryButton loading={saving} onPress={handleReviewShipment}>
                Review shipment
              </PrimaryButton>
            ) : null}
          </Card>

          {auth.user ? <View style={styles.section}>
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
                description="Create a shipment and Karri will look for travelers on the same route."
                marker="S"
                title="Ready to send your first package?"
              />
            ) : null}

            {!listLoading && !dataError
              ? shipments.map((shipment) => (
                  <Card key={shipment.id} variant="elevated">
                    <RouteCardHeader
                      destinationCity={shipment.destinationCity}
                      destinationCountry={shipment.destinationCountry}
                      originCity={shipment.originCity}
                      originCountry={shipment.originCountry}
                      status={shipment.status}
                      statusTone={shipment.status === "active" ? "active" : "neutral"}
                    />
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
          </View> : null}

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
  categoryField: {
    gap: spacing.xs,
  },
  categoryLabel: {
    color: colors.text,
    ...typography.label,
  },
  required: {
    color: colors.error,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  categoryOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: 140,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedCategoryOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressedCategoryOption: {
    opacity: 0.82,
  },
  categoryOptionText: {
    color: colors.primaryDark,
    textAlign: "center",
    ...typography.label,
  },
  selectedCategoryOptionText: {
    color: colors.white,
  },
  trustIndicator: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
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
  draftCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  draftHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  draftHeaderText: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 180,
  },
  draftEyebrow: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "800",
  },
  draftTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  draftSummary: {
    gap: spacing.xxs,
  },
  draftRoute: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  draftMeta: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  draftActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  weightField: {
    gap: spacing.xs,
  },
  weightLabel: {
    color: colors.text,
    ...typography.label,
  },
  weightOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  weightOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: 96,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedWeightOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weightOptionText: {
    color: colors.primaryDark,
    textAlign: "center",
    ...typography.label,
  },
  selectedWeightOptionText: {
    color: colors.white,
  },
  customWeight: {
    gap: spacing.sm,
  },
  unitToggle: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  unitOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
  },
  selectedUnitOption: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  unitOptionText: {
    color: colors.primaryDark,
    ...typography.label,
  },
  selectedUnitOptionText: {
    color: colors.primaryDark,
  },
  rewardSuggestion: {
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  rewardSuggestionContent: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 180,
  },
  rewardSuggestionEyebrow: {
    color: colors.gold,
    ...typography.caption,
    fontWeight: "800",
  },
  rewardSuggestionRange: {
    color: colors.text,
    ...typography.headline,
  },
  rewardSuggestionMuted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  rewardApplyButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.gold,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
  },
  rewardApplyButtonText: {
    color: colors.gold,
    ...typography.label,
  },
  reviewPanel: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.primarySoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  reviewHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  reviewHeaderText: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 180,
  },
  reviewEyebrow: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "800",
  },
  reviewTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  reviewRoute: {
    gap: spacing.xxs,
  },
  reviewRouteCity: {
    color: colors.textSecondary,
    ...typography.bodyStrong,
  },
  reviewRouteArrow: {
    color: colors.muted,
    ...typography.caption,
  },
  reviewRouteDestination: {
    color: colors.text,
    ...typography.headline,
  },
  reviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  reviewItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: 132,
    flexGrow: 1,
    gap: spacing.xxs,
    padding: spacing.sm,
  },
  reviewItemWide: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: 220,
    flexGrow: 1,
    gap: spacing.xxs,
    padding: spacing.sm,
  },
  reviewLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "800",
  },
  reviewValue: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  reviewDescription: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  reviewActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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





