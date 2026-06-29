import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { FormCard } from "../src/components/FormCard";
import { InfoCard } from "../src/components/InfoCard";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { TextInputField } from "../src/components/TextInputField";
import { colors, spacing } from "../src/theme/tokens";

export default function ProfileSetupScreen() {
  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Profile setup"
        title="Tell the community who you are"
        subtitle="Karri profiles should make senders and travelers feel safer before a booking starts."
      />

      <FormCard>
        <TextInputField label="Full name" placeholder="Your legal or preferred name" />
        <TextInputField
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.section}>
          <Text style={styles.label}>Role choice</Text>
          <View style={styles.choiceRow}>
            <Text style={styles.choice}>Sender</Text>
            <Text style={styles.choice}>Traveler</Text>
            <Text style={styles.choice}>Both</Text>
          </View>
        </View>

        <TextInputField
          label="Home region / diaspora location"
          placeholder="Washington, DC"
        />
        <TextInputField
          label="Primary destination country"
          placeholder="Ethiopia, Kenya, Uganda..."
        />

        <InfoCard
          title="Trust note"
          body="Identity, contact verification, and stronger safety checks will come later. For now, this is UI-only."
        />

        <PrimaryButton onPress={() => router.push("/(tabs)/home")}>Finish setup</PrimaryButton>
      </FormCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  choice: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});

