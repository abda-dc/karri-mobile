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
  createShipment,
  getFriendlyFirestoreError,
  subscribeToUserShipments,
} from "../../src/lib/firestore";
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
  const [shipments, setShipments] = useState<Shipment[]>([]);
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
      setShipments([]);
      return;
    }

    setListLoading(true);
    setDataError(null);

    try {
      return subscribeToUserShipments(
        auth.user.uid,
        (nextShipments) => {
          setShipments(nextShipments);
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
      await createShipment(auth.user.uid, {
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
      setFormError(getFriendlyFirestoreError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <StatusBar style="dark" />
      <ScreenHeader
        eyebrow="Sender flow"
        title="Send a package"
        subtitle="Describe the route, package, timing, and reward clearly so compatible travelers can evaluate the request."
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
            title={auth.error ? "Firebase setup or sign-in needed" : "Sign in to send"}
            body={
              auth.error ??
              "Shipments are scoped to your Firebase account, so Karri needs an authenticated session first."
            }
          />
          <PrimaryButton onPress={() => router.push("/login")}>Open sign in</PrimaryButton>
        </View>
      ) : null}

      {auth.user ? (
        <View style={styles.pageStack}>
          <FormCard>
            <Text style={styles.sectionTitle}>New shipment</Text>
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
            <TextInputField
              label="Package category"
              placeholder="Clothing, documents, personal care..."
              maxLength={80}
              value={form.packageCategory}
              onChangeText={(value) => updateField("packageCategory", value)}
            />
            <TextInputField
              label="Package description"
              placeholder="Describe what the traveler should expect"
              helperText="Do not include private recipient contact details."
              maxLength={500}
              multiline
              value={form.packageDescription}
              onChangeText={(value) => updateField("packageDescription", value)}
            />
            <TextInputField
              label="Weight estimate (kg)"
              placeholder="2.5"
              keyboardType="decimal-pad"
              value={form.weightKg}
              onChangeText={(value) => updateField("weightKg", value)}
            />
            <TextInputField
              label="Desired delivery window"
              placeholder="July 10–20, 2026"
              maxLength={120}
              value={form.deliveryWindow}
              onChangeText={(value) => updateField("deliveryWindow", value)}
            />
            <TextInputField
              label="Reward offer (USD)"
              placeholder="40"
              keyboardType="decimal-pad"
              value={form.rewardAmount}
              onChangeText={(value) => updateField("rewardAmount", value)}
            />

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

            <PrimaryButton disabled={saving} onPress={handleCreateShipment}>
              {saving ? "Saving shipment..." : "Save shipment"}
            </PrimaryButton>
          </FormCard>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your shipments</Text>

            {listLoading ? (
              <View style={styles.stateBlock}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.mutedText}>Loading your shipments...</Text>
              </View>
            ) : null}

            {!listLoading && dataError ? (
              <InfoCard title="Could not load shipments" body={dataError} />
            ) : null}

            {!listLoading && !dataError && shipments.length === 0 ? (
              <InfoCard
                title="No shipments yet"
                body="Your saved shipment requests will appear here. Create the first one above."
              />
            ) : null}

            {!listLoading && !dataError
              ? shipments.map((shipment) => (
                  <View key={shipment.id} style={styles.listingCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>
                        {shipment.originCity} → {shipment.destinationCity}
                      </Text>
                      <StatusPill label={shipment.status} />
                    </View>
                    <Text style={styles.routeText}>
                      {shipment.originCountry} → {shipment.destinationCountry}
                    </Text>
                    <Text style={styles.mutedText}>
                      {shipment.packageCategory} · {shipment.weightKg} kg · {shipment.rewardAmount}{" "}
                      {shipment.rewardCurrency}
                    </Text>
                    <Text style={styles.mutedText}>Delivery window: {shipment.deliveryWindow}</Text>
                    <Text style={styles.descriptionText}>{shipment.packageDescription}</Text>
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
