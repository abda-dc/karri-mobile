import { router } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import { Badge } from "../src/components/Badge";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { TrustBadge } from "../src/components/TrustBadge";
import { isFirebaseConfigured } from "../src/infrastructure/firebase/client";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function WelcomeScreen() {
  return (
    <Screen centered contentStyle={styles.screenContent}>
      {!isFirebaseConfigured ? (
        <Banner
          compact
          message="Add the local Firebase values before starting an authenticated development session."
          title="Development setup"
          variant="development"
        />
      ) : null}

      <View style={styles.hero}>
        <Image
          accessibilityLabel="Karri"
          resizeMode="contain"
          source={require("../assets/karri-logo.jpeg")}
          style={styles.logo}
        />
        <TrustBadge compact label="Community shipping, made clearer" />
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
