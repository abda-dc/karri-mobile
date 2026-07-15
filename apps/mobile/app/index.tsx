import { router } from "expo-router";
import { useEffect } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { Badge } from "../src/components/Badge";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { LoadingState } from "../src/components/LoadingState";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { useAuthSession } from "../src/presentation/hooks/useAuthSession";
import { mobileServices } from "../src/presentation/services/mobileServices";
import { colors, radii, spacing, typography } from "../src/theme/tokens";
import { PublicHomePage } from "../src/public/PublicHomePage";

export default function WelcomeScreen() {
  if (Platform.OS === "web") {
    return <PublicHomePage />;
  }

  return <NativeWelcomeScreen />;
}

function NativeWelcomeScreen() {
  const auth = useAuthSession();

  useEffect(() => {
    if (!auth.loading && auth.user) {
      router.replace("/(tabs)/home");
    }
  }, [auth.loading, auth.user]);

  if (auth.loading || auth.user) {
    return (
      <Screen centered contentStyle={styles.screenContent}>
        <LoadingState message="Restoring your Karri session..." />
      </Screen>
    );
  }

  return (
    <Screen centered contentStyle={styles.screenContent}>
      {!mobileServices.auth.isConfigured ? (
        <Banner
          compact
          message="Add the documented mobile environment values before starting a development session."
          title="Development setup"
          variant="development"
        />
      ) : null}

      <View style={styles.hero}>
        <Image
          accessibilityLabel="Karri"
          resizeMode="cover"
          source={require("../assets/karri-logo.jpeg")}
          style={styles.logo}
        />
        <Image
          accessibilityLabel="Karri community shipping"
          resizeMode="cover"
          source={require("../assets/home-trust-badge-icon.png")}
          style={styles.dashboardHeaderImage}
        />
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Welcome to Karri</Text>
          <Text style={styles.subtitle}>
            Trusted community shipping between travelers and senders.
          </Text>
          <Text style={styles.body}>
            Create shipments, share trips, and find reliable route matches across borders.
          </Text>
        </View>
      </View>

      <PrimaryButton onPress={() => router.push("/login")}>Get started</PrimaryButton>

      <Card style={styles.roleCard} variant="soft">
        <View style={styles.roleHeader}>
          <Text style={styles.roleTitle}>One community, two ways to help</Text>
          <Badge label="Mobile-first" tone="primary" />
        </View>
        <View style={styles.roleRow}>
          <View style={styles.roleItem}>
            <Text style={styles.roleLabel}>For senders</Text>
            <Text style={styles.roleBody}>Describe the route and package with clarity.</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.roleItem}>
            <Text style={styles.roleLabel}>For travelers</Text>
            <Text style={styles.roleBody}>Share your route and available capacity.</Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dashboardHeaderImage: {
    alignSelf: "stretch",
    borderRadius: 28,
    height: 180,
    overflow: "hidden",
    width: "100%",
  },
  screenContent: {
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.lg,
  },
  logo: {
    borderRadius: radii.xl,
    height: 84,
    width: 84,
  },
  heroCopy: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    ...typography.display,
  },
  subtitle: {
    color: colors.primaryDark,
    ...typography.headline,
  },
  body: {
    color: colors.textSecondary,
    ...typography.body,
  },
  roleCard: {
    gap: spacing.lg,
  },
  roleHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  roleTitle: {
    color: colors.text,
    flexShrink: 1,
    ...typography.subheading,
  },
  roleRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  roleItem: {
    flex: 1,
    gap: spacing.xs,
  },
  roleLabel: {
    color: colors.primary,
    ...typography.label,
  },
  roleBody: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  divider: {
    backgroundColor: colors.border,
    width: 1,
  },
});





