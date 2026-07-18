import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { TextField } from "../src/components/TextField";
import { mobileServices } from "../src/presentation/services/mobileServices";
import { evaluateAdminRouteDecision } from "../src/domain/authorization/authorization";
import { getFriendlyError } from "../src/presentation/errors/getFriendlyError";
import { spacing } from "../src/theme/tokens";

export default function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await mobileServices.auth.signInWithEmail(trimmedEmail, password);

      if (session.identity.isAnonymous) {
        throw new Error("Anonymous identities are not allowed access.");
      }

      const decision = evaluateAdminRouteDecision({
        loading: false,
        user: session.identity,
        role: session.authorization.role,
        verified: true, // We just did a fresh email sign-in which resolved the token claims
        error: null,
      });

      // Clear the password from memory immediately after successful authentication
      setPassword("");

      if (decision === "allowed") {
        router.replace("/(admin)");
      } else {
        router.replace("/access-denied");
      }
    } catch (signInError: unknown) {
      // Clear password from memory on failure
      setPassword("");

      // Get the safe user-facing friendly error message
      setError(getFriendlyError(signInError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen centered contentStyle={styles.content}>
      <SectionHeader
        eyebrow="Administrator Access"
        subtitle="Sign in with your administrator credentials to access the secure console. Administrative roles are provisioned by system operators."
        title="Karri Console Sign In"
      />

      <Card variant="elevated">
        {error ? (
          <Banner message={error} title="Sign In Failed" variant="error" />
        ) : null}

        <View style={styles.form}>
          <TextField
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            label="Email Address"
            onChangeText={setEmail}
            required
            value={email}
            editable={!loading}
            accessibilityLabel="Email Address"
          />

          <TextField
            autoCapitalize="none"
            autoComplete="password"
            autoCorrect={false}
            label="Password"
            onChangeText={setPassword}
            required
            secureTextEntry
            value={password}
            editable={!loading}
            accessibilityLabel="Password"
          />
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            accessibilityHint="Authenticates your administrative account."
            accessibilityLabel="Sign In to Console"
            loading={loading}
            onPress={handleSignIn}
          >
            Sign In to Console
          </PrimaryButton>

          <PrimaryButton
            accessibilityHint="Returns to the standard Karri setup."
            accessibilityLabel="Back to Customer Setup"
            disabled={loading}
            variant="ghost"
            onPress={() => router.replace("/login")}
          >
            Back to Customer Setup
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
  form: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.xs,
  },
});
