import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { TextField } from "../src/components/TextField";
import { isFirebaseConfigured } from "../src/lib/firebase";
import { spacing } from "../src/theme/tokens";

export default function LoginScreen() {
  const [email, setEmail] = useState("");

  return (
    <Screen centered contentStyle={styles.content}>
      <SectionHeader
        eyebrow="Welcome"
        subtitle="Trusted community shipping starts with a clear account and a shared route."
        title="Welcome to Karri"
      />

      <Card variant="elevated">
        <SectionHeader
          subtitle="Enter the email you want to use with Karri."
          title="Continue with email"
        />
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          required
          value={email}
        />

        <Banner
          compact
          message={
            isFirebaseConfigured
              ? "Email delivery is not active yet. The next step uses Karri's anonymous Firebase session bridge."
              : "Firebase is not configured locally. Add the values from apps/mobile/.env.example before continuing."
          }
          title="Development Mode"
          variant="development"
        />

        <View style={styles.actions}>
          <PrimaryButton disabled={!email.trim()} onPress={() => router.push("/verify")}>
            Continue
          </PrimaryButton>
          <PrimaryButton variant="ghost" onPress={() => router.back()}>
            Back
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
    gap: spacing.xs,
  },
});
