import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { TrustBadge } from "../src/components/TrustBadge";
import { reportFriendlyError } from "../src/presentation/errors/getFriendlyError";
import { mobileServices } from "../src/presentation/services/mobileServices";
import { spacing } from "../src/theme/tokens";

export default function VerifyScreen() {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setIsStarting(true);
    setError(null);

    try {
      await mobileServices.auth.startMvpSession();
      router.replace("/profile-setup");
    } catch (sessionError) {
      setError(reportFriendlyError(sessionError, "verify.start-auth-session"));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <Screen centered contentStyle={styles.content}>
      <SectionHeader
        eyebrow="One more step"
        subtitle="Create or restore your temporary Karri account on this device, then choose how you want to participate."
        title="Secure your Karri activity"
      />

      <Card variant="elevated">
        <TrustBadge
          detail="Shipments, trips, bookings, and trust activity stay scoped to the current Karri account while this device session remains available."
          label="Private app activity"
        />
        {mobileServices.auth.isConfigured ? (
          <Banner
            compact
            message="This temporary account does not provide email login, account recovery, verified identity, or automatic trust-score verification yet."
            title="Temporary account limits"
            variant="info"
          />
        ) : (
          <Banner
            compact
            message="Karri is not configured locally, so account setup cannot start yet."
            title="Development Mode"
            variant="development"
          />
        )}

        {error ? (
          <Banner message={error} title="Account setup could not start" variant="error" />
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            accessibilityHint="Creates or restores your temporary Karri account and then opens profile setup."
            loading={isStarting}
            onPress={handleContinue}
          >
            {isStarting ? "Setting up account..." : "Create or restore account"}
          </PrimaryButton>
          <PrimaryButton
            accessibilityHint="Returns to the temporary account introduction screen."
            disabled={isStarting}
            variant="secondary"
            onPress={() => router.back()}
          >
            Back to introduction
          </PrimaryButton>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  actions: {
    gap: spacing.sm,
  },
});
