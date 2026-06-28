import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { FormCard } from "../src/components/FormCard";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { TextInputField } from "../src/components/TextInputField";
import { spacing } from "../src/theme/tokens";

export default function VerifyScreen() {
  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Verification"
        title="Check your email"
        subtitle="Use the one-time code from your inbox. This screen is a static placeholder until Supabase auth is added."
      />

      <FormCard>
        <TextInputField
          label="One-time code"
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
        />

        <View style={styles.actions}>
          <PrimaryButton onPress={() => router.push("/profile-setup")}>
            Verify code
          </PrimaryButton>
          <PrimaryButton variant="secondary" onPress={() => router.push("/login")}>
            Use a different email
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
