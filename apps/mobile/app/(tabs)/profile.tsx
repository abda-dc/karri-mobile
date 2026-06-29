import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "../../src/components/AppScreen";
import { InfoCard } from "../../src/components/InfoCard";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { StatusPill } from "../../src/components/StatusPill";
import { spacing } from "../../src/theme/tokens";

export default function ProfileScreen() {
  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Profile"
        title="Your Karri identity"
        subtitle="This tab will hold profile details, verification status, contact settings, and trust signals."
      >
        <StatusPill label="Verification later" />
      </ScreenHeader>

      <View style={styles.cards}>
        <InfoCard
          title="Profile details"
          body="Name, email, role, home region, and destination preferences will appear here."
        />
        <InfoCard
          title="Trust checks"
          body="Identity verification and contact verification will be added after the UI foundation is stable."
        />
        <InfoCard
          title="Community safety"
          body="Clear profiles help senders and travelers understand who they are coordinating with."
        />
      </View>

      <PrimaryButton variant="secondary" onPress={() => router.push("/profile-setup")}>
        Edit setup placeholder
      </PrimaryButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
});
