import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { TrustBadge } from "../src/components/TrustBadge";
import {
  getFriendlyAuthError,
  startMvpAuthSession,
} from "../src/infrastructure/firebase/auth";
import { isFirebaseConfigured } from "../src/infrastructure/firebase/client";
import { spacing } from "../src/theme/tokens";

export default function VerifyScreen() {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setIsStarting(true);
    setError(null);

    try {
      await startMvpAuthSession();
      router.replace("/profile-setup");
    } catch (sessionError) {
      setError(getFriendlyAuthError(sessionError));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <Screen centered contentStyle={styles.content}>
      <SectionHeader
        eyebrow="One more step"
        subtitle="Create a Karri development session, then choose how you want to participate."
        title="You&apos;re almost ready"
      />

      <Card variant="elevated">
        <TrustBadge
          detail="Your shipment and trip records stay scoped to your Firebase user."
          label="Account-scoped activity"
        />
        <Banner
          compact
          message={
            isFirebaseConfigured
              ? "Karri will use an anonymous Firebase session for this MVP. It is not identity verification or a trust score."
              : "Firebase is not configured locally, so a development session cannot start yet."
          }
          title="Development Mode"
          variant="development"
        />

        {error ? <Banner message={error} title="Session could not start" variant="error" /> : null}

        <View style={styles.actions}>
          <PrimaryButton loading={isStarting} onPress={handleContinue}>
            {isStarting ? "Starting session..." : "Continue"}
          </PrimaryButton>
          <PrimaryButton
            disabled={isStarting}
            variant="secondary"
            onPress={() => router.push("/login")}
          >
            Back to email
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
