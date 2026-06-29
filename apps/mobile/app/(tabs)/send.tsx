import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import { TextField } from "../../src/components/TextField";
import { TrustBadge } from "../../src/components/TrustBadge";
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
    <Screen contentStyle={styles.page} withTabBar>
      <SectionHeader
        eyebrow="Send with Karri"
        subtitle="Share the route, package, timing, and reward a traveler needs to evaluate your request."
        title="Create a shipment"
      />

      <TrustBadge
        detail="Clear package details help travelers make informed choices."
        label="Clarity builds trust"
      />

      {auth.loading ? (
        <Card style={styles.loadingCard} variant="outlined">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.mutedText}>Checking your Karri session...</Text>
        </Card>
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
              <Card style={styles.loadingCard} variant="outlined">
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.mutedText}>Loading your shipments...</Text>
              </Card>
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
        </View>
      ) : null}
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
  fieldRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  fieldColumn: {
    flexBasis: 200,
    flexGrow: 1,
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
