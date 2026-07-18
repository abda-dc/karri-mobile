import { Redirect, router } from "expo-router";
import { useState, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { useAuthSession } from "../src/presentation/hooks/useAuthSession";
import { mobileServices } from "../src/presentation/services/mobileServices";
import { colors, spacing, typography } from "../src/theme/tokens";

export default function AccessDeniedScreen() {
  const { authorizationRole } = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signingOutRef = useRef(false);

  async function handleSignOut(targetRoute: "/admin-login" | "/login" = "/admin-login") {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await mobileServices.auth.signOut();
      signingOutRef.current = false;
      setLoading(false);
      router.replace(targetRoute);
    } catch (signOutError: unknown) {
      signingOutRef.current = false;
      setLoading(false);
      setError("Sign out failed. Please check your network connection and try again.");
    }
  }

  return (
    <Screen centered contentStyle={styles.content}>
      <SectionHeader
        eyebrow="Access Denied"
        subtitle="Your account is not authorized to access this restricted area."
        title="Unauthorized Access"
      />

      <Card variant="elevated">
        <Banner
          message={`Your account role is currently: '${authorizationRole}'. Administrative operations and safety panels require higher security permissions.`}
          title="Insufficient Permissions"
          variant="error"
        />

        {error ? (
          <View style={{ marginTop: spacing.md }}>
            <Banner
              message={error}
              title="Sign Out Failed"
              variant="error"
            />
          </View>
        ) : null}

        <View style={styles.details}>
          <Text style={styles.detailText}>
            If you believe this is an error, please ask your systems administrator or operator to update your account claims using the Firebase Admin CLI.
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            accessibilityHint="Logs out of the current account."
            accessibilityLabel="Sign Out and Switch Account"
            loading={loading}
            onPress={() => handleSignOut("/admin-login")}
          >
            Sign Out & Switch Account
          </PrimaryButton>

          <PrimaryButton
            accessibilityHint="Goes back to standard login screen."
            accessibilityLabel="Go to Customer Login"
            disabled={loading}
            variant="ghost"
            onPress={() => handleSignOut("/login")}
          >
            Go to Customer Login
          </PrimaryButton>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  details: {
    marginVertical: spacing.md,
  },
  detailText: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: "center",
  },
  actions: {
    gap: spacing.xs,
  },
});
