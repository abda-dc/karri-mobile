import { router } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { TextField } from "../src/components/TextField";
import { mobileServices } from "../src/presentation/services/mobileServices";
import { spacing } from "../src/theme/tokens";

export default function LoginScreen() {
  const [email, setEmail] = useState("");

  return (
    <Screen contentStyle={styles.content}>
      <Image
        source={require("../assets/login-trust-badge-icon.png")}
        style={styles.loginBadge}
        resizeMode="cover"
      />

      <Card variant="elevated">
        <SectionHeader
          subtitle="Enter the email you want to use with Karri."
          title="Continue with email"
        />
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          required
          value={email}
        />

        <Banner
          compact
          message={
            mobileServices.auth.isConfigured
              ? "Email delivery is not active yet. The next step uses Karri's anonymous Firebase session bridge."
              : "Karri is not configured locally. Add the documented mobile environment values before continuing."
          }
          title="Development Mode"
          variant="development"
        />

        <View style={styles.actions}>
          <PrimaryButton
            disabled={!email.trim()}
            onPress={() => router.push("/verify")}
          >
            Continue
          </PrimaryButton>
          <PrimaryButton variant="ghost" onPress={() => router.back()}>
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
