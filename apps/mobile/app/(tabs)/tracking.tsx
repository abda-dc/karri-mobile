import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import { TrustBadge } from "../../src/components/TrustBadge";
import { colors, spacing, typography } from "../../src/theme/tokens";

const plannedStages = ["Pickup", "In transit", "Delivered"];

export default function TrackingScreen() {
  return (
    <Screen contentStyle={styles.page} withTabBar>
      <SectionHeader
        eyebrow="Chain of custody"
        subtitle="A future Karri journey will make responsibility and handoffs easy to understand."
        title="Tracking with clarity"
      />

      <TrustBadge
        detail="Every important handoff is designed to become visible and understandable."
        label="Custody-first experience"
      />

      <EmptyState
        action={
          <PrimaryButton variant="secondary" onPress={() => router.push("/(tabs)/home")}>
            Back to home
          </PrimaryButton>
        }
        description="There are no trackable journeys in this MVP. Booking and custody workflows are not active yet."
        marker="C"
        title="Nothing to track yet"
      />

      <Card variant="outlined">
        <SectionHeader
          subtitle="The eventual timeline will prioritize current responsibility and the next expected action."
          title="Planned journey view"
        />
        <View style={styles.stages}>
          {plannedStages.map((stage, index) => (
            <View key={stage} style={styles.stageRow}>
              <StatusChip label="Planned" tone="neutral" />
              <View style={styles.stageCopy}>
                <Text style={styles.stageTitle}>{stage}</Text>
                <Text style={styles.stageBody}>Step {index + 1} of the custody journey.</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.xl,
  },
  stages: {
    gap: spacing.md,
  },
  stageRow: {
    alignItems: "flex-start",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  stageCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  stageTitle: {
    color: colors.text,
    ...typography.label,
  },
  stageBody: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
