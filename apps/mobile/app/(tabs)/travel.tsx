import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../../src/components/AppScreen";
import { InfoCard } from "../../src/components/InfoCard";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { StatusPill } from "../../src/components/StatusPill";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function TravelScreen() {
  return (
    <AppScreen>
      <StatusBar style="dark" />
      <View style={styles.stack}>
        <StatusPill label="Traveler flow" />
        <Text style={styles.title}>I&apos;m traveling</Text>
        <Text style={styles.body}>
          This will become the trip creation flow for travelers who can carry packages
          for the community.
        </Text>
        <InfoCard
          title="Coming next"
          body="Trip route, luggage capacity, travel date, handoff preferences, and traveler availability."
        />
        <PrimaryButton variant="secondary" onPress={() => router.back()}>
          Back home
        </PrimaryButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.headline,
    fontWeight: "900",
  },
  body: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
});

