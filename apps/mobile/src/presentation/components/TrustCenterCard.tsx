import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SectionHeader } from "../../components/SectionHeader";
import { spacing } from "../../theme/tokens";

const trustLinks = [
  { label: "Trust & Safety", route: "/trust-center" },
  { label: "Community Guidelines", route: "/community-guidelines" },
  { label: "Prohibited Items", route: "/prohibited-items" },
  { label: "Privacy Policy", route: "/privacy-policy" },
  { label: "Terms of Service", route: "/terms-of-service" },
  { label: "FAQ", route: "/faq" },
  { label: "Support", route: "/support" },
] as const;

export function TrustCenterCard() {
  return (
    <Card variant="outlined">
      <SectionHeader
        eyebrow="Trust and community"
        subtitle="Learn how Karri protects senders, travelers, and packages."
        title="Trust Center"
      />

      <View style={styles.links}>
        {trustLinks.map((link) => (
          <PrimaryButton
            key={link.route}
            accessibilityHint={`Open ${link.label}`}
            variant="secondary"
            onPress={() => router.push(link.route)}
          >
            {`\u203A  ${link.label}`}
          </PrimaryButton>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  links: {
    gap: spacing.sm,
  },
});
