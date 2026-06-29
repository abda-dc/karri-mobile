import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../../src/components/AppScreen";
import { FormCard } from "../../src/components/FormCard";
import { InfoCard } from "../../src/components/InfoCard";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { StatusPill } from "../../src/components/StatusPill";
import { TextInputField } from "../../src/components/TextInputField";
import { useAuthSession } from "../../src/lib/auth";
import {
  createTrip,
  getFriendlyFirestoreError,
  subscribeToUserTrips,
} from "../../src/lib/firestore";
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      return subscribeToUserTrips(
        auth.user.uid,
        (nextTrips) => {
          setTrips(nextTrips);
          setListLoading(false);
          setDataError(null);
        },
        (error) => {
          setDataError(getFriendlyFirestoreError(error));
          setListLoading(false);
        },
      );
    } catch (error) {
      setDataError(getFriendlyFirestoreError(error));
      setListLoading(false);
    }
  }, [auth.loading, auth.user]);

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
      await createTrip(auth.user.uid, {
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
      setFormError(getFriendlyFirestoreError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <StatusBar style="dark" />
      <ScreenHeader
        eyebrow="Traveler flow"
        title="Share a trip"
        subtitle="Publish your route, dates, and spare capacity so senders can see a possible corridor match."
      />

      {auth.loading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.mutedText}>Checking your Karri session...</Text>
        </View>
      ) : null}

      {!auth.loading && !auth.user ? (
        <View style={styles.section}>
          <InfoCard
            title={auth.error ? "Firebase setup or sign-in needed" : "Sign in to share a trip"}
            body={
              auth.error ??
              "Trips are scoped to your Firebase account, so Karri needs an authenticated session first."
            }
          />
          <PrimaryButton onPress={() => router.push("/login")}>Open sign in</PrimaryButton>
        </View>
      ) : null}

      {auth.user ? (
        <View style={styles.pageStack}>
          <FormCard>
            <Text style={styles.sectionTitle}>New trip</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldColumn}>
                <TextInputField
                  label="Origin country"
                  placeholder="United States"
                  maxLength={80}
                  value={form.originCountry}
                  onChangeText={(value) => updateField("originCountry", value)}
                />
              </View>
              <View style={styles.fieldColumn}>
                <TextInputField
                  label="Origin city"
                  placeholder="Washington, DC"
                  maxLength={120}
                  value={form.originCity}
                  onChangeText={(value) => updateField("originCity", value)}
                />
              </View>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldColumn}>
                <TextInputField
                  label="Destination country"
                  placeholder="Kenya"
                  maxLength={80}
                  value={form.destinationCountry}
                  onChangeText={(value) => updateField("destinationCountry", value)}
                />
              </View>
              <View style={styles.fieldColumn}>
                <TextInputField
                  label="Destination city"
                  placeholder="Nairobi"
                  maxLength={120}
                  value={form.destinationCity}
                  onChangeText={(value) => updateField("destinationCity", value)}
                />
              </View>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldColumn}>
                <TextInputField
                  label="Departure date"
                  placeholder="2026-07-10"
                  helperText="Use YYYY-MM-DD."
                  maxLength={10}
                  value={form.departureDate}
                  onChangeText={(value) => updateField("departureDate", value)}
                />
              </View>
              <View style={styles.fieldColumn}>
                <TextInputField
                  label="Arrival date"
                  placeholder="2026-07-11"
                  helperText="Use YYYY-MM-DD."
                  maxLength={10}
                  value={form.arrivalDate}
                  onChangeText={(value) => updateField("arrivalDate", value)}
                />
              </View>
            </View>
            <TextInputField
              label="Available luggage capacity (kg)"
              placeholder="8"
              keyboardType="decimal-pad"
              value={form.availableCapacityKg}
              onChangeText={(value) => updateField("availableCapacityKg", value)}
            />
            <TextInputField
              label="Notes (optional)"
              placeholder="Handoff availability or package preferences"
              helperText="Do not add private contact or travel-document details."
              maxLength={500}
              multiline
              value={form.notes}
              onChangeText={(value) => updateField("notes", value)}
            />

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

            <PrimaryButton disabled={saving} onPress={handleCreateTrip}>
              {saving ? "Saving trip..." : "Save trip"}
            </PrimaryButton>
          </FormCard>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your trips</Text>

            {listLoading ? (
              <View style={styles.stateBlock}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.mutedText}>Loading your trips...</Text>
              </View>
            ) : null}

            {!listLoading && dataError ? <InfoCard title="Could not load trips" body={dataError} /> : null}

            {!listLoading && !dataError && trips.length === 0 ? (
              <InfoCard
                title="No trips yet"
                body="Your saved travel routes will appear here. Create the first one above."
              />
            ) : null}

            {!listLoading && !dataError
              ? trips.map((trip) => (
                  <View key={trip.id} style={styles.listingCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>
                        {trip.originCity} → {trip.destinationCity}
                      </Text>
                      <StatusPill label={trip.status} />
                    </View>
                    <Text style={styles.routeText}>
                      {trip.originCountry} → {trip.destinationCountry}
                    </Text>
                    <Text style={styles.mutedText}>
                      {trip.departureDate} → {trip.arrivalDate} · {trip.availableCapacityKg} kg available
                    </Text>
                    {trip.notes ? <Text style={styles.descriptionText}>{trip.notes}</Text> : null}
                  </View>
                ))
              : null}
          </View>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pageStack: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.headline,
    fontWeight: "900",
  },
  fieldRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  fieldColumn: {
    flexBasis: 180,
    flexGrow: 1,
  },
  stateBlock: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  listingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    gap: spacing.xs,
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
    fontSize: 17,
    fontWeight: "900",
  },
  routeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  descriptionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  mutedText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.warning,
    fontSize: 14,
    lineHeight: 20,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
});
