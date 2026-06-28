import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { InfoCard } from "../src/components/InfoCard";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { spacing } from "../src/theme/tokens";

export default function AppHomeScreen() {
  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Karri home"
        title="What do you want to do today?"
        subtitle="This will become the signed-in dashboard for listings, trips, bookings, and alerts."
      />

      <View style={styles.actions}>
        <PrimaryButton onPress={() => router.push("/send")}>Send a package</PrimaryButton>
        <PrimaryButton variant="secondary" onPress={() => router.push("/travel")}>
          I&apos;m traveling
        </PrimaryButton>
        <PrimaryButton variant="secondary" onPress={() => router.push("/tracking")}>
          Track a booking
        </PrimaryButton>
      </View>

      <View style={styles.cards}>
        <InfoCard
          title="Listings"
          body="Sender package listings will appear here after the MVP data model is connected."
        />
        <InfoCard
          title="Trips"
          body="Traveler trip routes and available luggage space will live here."
        />
        <InfoCard
          title="Alerts"
          body="Pickup, custody, delivery, and booking status updates will be surfaced clearly."
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  cards: {
    gap: spacing.md,
  },
});
