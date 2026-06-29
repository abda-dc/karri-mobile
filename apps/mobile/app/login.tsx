import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { FormCard } from "../src/components/FormCard";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { TextInputField } from "../src/components/TextInputField";
import { spacing } from "../src/theme/tokens";

export default function LoginScreen() {
  const [email, setEmail] = useState("");

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Email sign in"
        title="Welcome back to Karri"
        subtitle="Production email verification is the next auth step. This foundation uses Firebase and clearly starts a temporary MVP session on the next screen."
      />

      <FormCard>
        <TextInputField
          label="Email address"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.actions}>
          <PrimaryButton disabled={!email.trim()} onPress={() => router.push("/verify")}>
            Continue
          </PrimaryButton>
          <PrimaryButton variant="secondary" onPress={() => router.back()}>
            Back
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
});
