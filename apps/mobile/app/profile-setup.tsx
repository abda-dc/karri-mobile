import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Badge } from "../src/components/Badge";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { TextField } from "../src/components/TextField";
import { TrustBadge } from "../src/components/TrustBadge";
import { spacing } from "../src/theme/tokens";

export default function ProfileSetupScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader
        eyebrow="Profile setup"
        subtitle="A clear profile helps senders and travelers understand who they are coordinating with."
        title="How will you use Karri?"
      />

      <TrustBadge
        detail="Clear roles and expectations are the first layer of community trust."
        label="Trust grows with clarity"
      />

      <Card variant="elevated">
        <SectionHeader subtitle="Use details you are comfortable sharing in the MVP." title="About you" />
        <TextField label="Full name" placeholder="Your legal or preferred name" />
        <TextField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          placeholder="you@example.com"
        />

        <View style={styles.roles}>
          <SectionHeader
            subtitle="You can participate in either role—or both."
            title="Role interests"
          />
          <View style={styles.roleRow}>
            <Badge label="Sender" tone="primary" />
            <Badge label="Traveler" tone="info" />
            <Badge label="Both" tone="gold" />
          </View>
        </View>

        <TextField label="Home region" placeholder="Washington, DC" />
        <TextField
          label="Primary destination country"
          placeholder="Ethiopia, Kenya, Uganda..."
        />

        <Banner
          compact
          message="Profile fields are a visual preview in this release and are not saved yet."
          title="Development Mode"
          variant="development"
        />

        <PrimaryButton onPress={() => router.push("/(tabs)/home")}>Finish setup</PrimaryButton>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  roles: {
    gap: spacing.sm,
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
