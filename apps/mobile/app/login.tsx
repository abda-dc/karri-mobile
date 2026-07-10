import { router } from "expo-router";
import { Image, StyleSheet, View } from "react-native";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { mobileServices } from "../src/presentation/services/mobileServices";
import { spacing } from "../src/theme/tokens";

export default function LoginScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <Image
        source={require("../assets/login-trust-badge-icon.png")}
        style={styles.loginBadge}
        resizeMode="cover"
      />

      <Card variant="elevated">
        <SectionHeader
          subtitle="Karri creates a private temporary account for this device so your shipment, trip, booking, and trust activity stays separate from other users. Email login, account recovery, verified identity, and automatic trust-score verification are not enabled in this MVP yet."
          title="Start your Karri account setup"
        />

        {mobileServices.auth.isConfigured ? (
          <Banner
            compact
            message="Your temporary account can keep activity available on this device while the current session remains active, but it does not include email login, account recovery, verified identity, or automatic trust-score verification."
            title="Temporary account limits"
            variant="info"
          />
        ) : (
          <Banner
            compact
            message="Karri is not configured locally. Add the documented mobile environment values before continuing."
            title="Development Mode"
            variant="development"
          />
        )}

        <View style={styles.actions}>
          <PrimaryButton
            accessibilityHint="Opens the secure setup step for your temporary Karri account."
            onPress={() => router.push("/verify")}
          >
            Continue to secure setup
          </PrimaryButton>
          <PrimaryButton
            accessibilityHint="Returns to the previous screen."
            variant="ghost"
            onPress={() => router.back()}
          >
            Back
          </PrimaryButton>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 0,
  },
  loginBadge: {
    alignSelf: "stretch",
    borderRadius: 22,
    height: 220,
    marginBottom: -1,
    width: "100%",
  },
  actions: {
    gap: spacing.xs,
  },
});
