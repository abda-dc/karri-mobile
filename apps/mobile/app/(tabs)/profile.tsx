import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import { TrustBadge } from "../../src/components/TrustBadge";
import { colors, spacing, typography } from "../../src/theme/tokens";

const readinessItems = [
  {
    title: "Profile details",
    body: "Name, role, home region, and destination preferences.",
  },
  {
    title: "Contact verification",
    body: "A future signal that helps participants understand account readiness.",
  },
  {
    title: "Community history",
    body: "Completed journeys and eligible reviews will provide context later.",
  },
];

export default function ProfileScreen() {
  return (
    <Screen contentStyle={styles.page} withTabBar>
      <SectionHeader
        action={<StatusChip label="Foundation" tone="info" />}
        eyebrow="Profile"
        subtitle="Your profile will help the community understand how you participate in Karri."
        title="Your Karri identity"
      />

      <TrustBadge
        detail="Trust signals will be evidence-based and clearly explained—not implied by a badge alone."
        label="Profile readiness"
      />

      <Banner
        compact
        message="Profile saving and identity verification are not connected in this release."
        title="Development Mode"
        variant="development"
      />

      <Card variant="elevated">
        <SectionHeader title="What your profile will include" />
        <View style={styles.items}>
          {readinessItems.map((item, index) => (
            <View key={item.title} style={styles.item}>
              <View style={styles.numberMark}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
        <PrimaryButton variant="secondary" onPress={() => router.push("/profile-setup")}>
          Review profile setup
        </PrimaryButton>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.xl,
  },
  items: {
    gap: spacing.md,
  },
  item: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  numberMark: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  numberText: {
    color: colors.primary,
    ...typography.label,
  },
  itemCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  itemTitle: {
    color: colors.text,
    ...typography.label,
  },
  itemBody: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
