import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../src/components/AppScreen";
import { InfoCard } from "../src/components/InfoCard";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { StatusPill } from "../src/components/StatusPill";
import { colors, spacing, typography } from "../src/theme/tokens";

export default function HomeScreen() {
  return (
    <AppScreen>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Image
          source={require("../assets/karri-logo.jpeg")}
          style={styles.logo}
          resizeMode="contain"
        />

        <StatusPill label="Mobile MVP" />

        <Text style={styles.title}>Karri Mobile</Text>
        <Text style={styles.subtitle}>
          A safer way for diaspora senders and trusted travelers to coordinate packages,
          custody, and delivery updates.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={() => router.push("/send")}>Send a package</PrimaryButton>
        <PrimaryButton variant="secondary" onPress={() => router.push("/travel")}>
          I&apos;m traveling
        </PrimaryButton>
      </View>

      <View style={styles.cards}>
        <InfoCard
          title="Trust starts with identity"
          body="Profiles, verified contact details, and clear roles will help users know who they are working with."
        />
        <InfoCard
          title="Custody stays visible"
          body="Every booking should make pickup, handoff, transit, and delivery status easy to understand."
        />
        <InfoCard
          title="Status before confusion"
          body="Tracking and alerts will keep senders and travelers aligned before problems grow."
        />
      </View>

      <PrimaryButton variant="secondary" onPress={() => router.push("/tracking")}>
        View tracking placeholder
      </PrimaryButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 40,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  cards: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
});
