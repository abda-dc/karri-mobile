import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { FormCard } from "../src/components/FormCard";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { TextInputField } from "../src/components/TextInputField";
import { spacing } from "../src/theme/tokens";

export default function LoginScreen() {
  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Email sign in"
        title="Welcome back to Karri"
        subtitle="Enter your email to receive a secure one-time code. Real authentication will connect to Supabase later."
      />

      <FormCard>
        <TextInputField
          label="Email address"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.actions}>
          <PrimaryButton onPress={() => router.push("/verify")}>Continue</PrimaryButton>
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
