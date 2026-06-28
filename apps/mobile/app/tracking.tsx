import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { InfoCard } from "../src/components/InfoCard";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { StatusPill } from "../src/components/StatusPill";
import { colors, spacing, typography } from "../src/theme/tokens";

export default function TrackingScreen() {
  return (
    <AppScreen>
      <StatusBar style="dark" />
      <View style={styles.stack}>
        <StatusPill label="Tracking" />
        <Text style={styles.title}>Booking status tracking</Text>
        <Text style={styles.body}>
          This placeholder will become the simple timeline for booking requests,
          custody handoff, transit, and delivery confirmation.
        </Text>
        <InfoCard
          title="MVP status model"
          body="Requested ? Accepted ? Picked up ? In transit ? Delivered."
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
