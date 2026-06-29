import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { FormCard } from "../src/components/FormCard";
import { InfoCard } from "../src/components/InfoCard";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { getFriendlyAuthError, startMvpAuthSession } from "../src/lib/auth";
import { colors, spacing } from "../src/theme/tokens";

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
    <AppScreen>
      <ScreenHeader
        eyebrow="MVP authentication"
        title="Start your Karri session"
        subtitle="Email code delivery is not enabled yet. Continue creates a temporary Firebase Auth account so your listings have a real owner."
      />

      <FormCard>
        <InfoCard
          title="Temporary account"
          body="This anonymous Firebase account is not an identity verification or trust signal. It will be replaced or linked when production authentication is implemented."
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <PrimaryButton disabled={isStarting} onPress={handleContinue}>
            {isStarting ? "Starting session..." : "Continue to profile setup"}
          </PrimaryButton>
          <PrimaryButton
            disabled={isStarting}
            variant="secondary"
            onPress={() => router.push("/login")}
          >
            Back to email
          </PrimaryButton>
        </View>
      </FormCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.warning,
    fontSize: 14,
    lineHeight: 20,
  },
});
