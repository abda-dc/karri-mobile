import { router } from "expo-router";
import { useState, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { Banner } from "../../src/components/Banner";
import { useAuthSession } from "../../src/presentation/hooks/useAuthSession";
import { mobileServices } from "../../src/presentation/services/mobileServices";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function AdminDashboardPlaceholder() {
  const { user, authorizationRole } = useAuthSession();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const signingOutRef = useRef(false);

  async function handleSignOut() {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSignOutError(null);
    setLoading(true);
    try {
      await mobileServices.auth.signOut();
      signingOutRef.current = false;
      setLoading(false);
      router.replace("/admin-login");
    } catch (err: unknown) {
      signingOutRef.current = false;
      setLoading(false);
      setSignOutError("Sign out failed. Please check your network connection and try again.");
    }
  }

  return (
    <Screen centered contentStyle={styles.content}>
      <SectionHeader
        eyebrow="Admin Area"
        subtitle="This is a secure area for administrative tasks."
        title="Admin Console"
      />

      <Card variant="elevated">
        <Text style={styles.text}>Welcome, {user?.uid}</Text>
        <Text style={styles.text}>Role: {authorizationRole}</Text>

        {signOutError ? (
          <View style={{ marginTop: spacing.md }}>
            <Banner
              message={signOutError}
              title="Sign Out Failed"
              variant="error"
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton loading={loading} disabled={loading} onPress={handleSignOut}>
            Sign Out
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
  text: {
    color: colors.text,
    ...typography.body,
    marginBottom: spacing.xs,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
});
