import { router } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { TextField } from "../src/components/TextField";
import { getFriendlyError } from "../src/presentation/errors/getFriendlyError";
import { mobileServices } from "../src/presentation/services/mobileServices";
import { colors, spacing, typography } from "../src/theme/tokens";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function handleSendLink() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setFieldError("Please enter your email address.");
      return;
    }

    if (!emailPattern.test(trimmedEmail)) {
      setFieldError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    setFieldError(undefined);
    setError(null);
    setLoading(true);

    try {
      await mobileServices.auth.sendSignInLinkToEmail(trimmedEmail);
      router.push({
        pathname: "/verify",
        params: { email: trimmedEmail },
      });
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <Image
        source={require("../assets/login-trust-badge-icon.png")}
        style={styles.loginBadge}
        resizeMode="cover"
      />

      <Card variant="elevated">
        <SectionHeader
          eyebrow="Customer Access"
          subtitle="Enter your email to receive a secure sign-in link. No password required. Your shipments, trips, and bookings stay attached to your account."
          title="Sign in or create account"
        />

        {!mobileServices.auth.isConfigured ? (
          <Banner
            compact
            message="Karri is not configured locally. Add the documented mobile environment values before continuing."
            title="Development Mode"
            variant="development"
          />
        ) : null}

        {error ? (
          <Banner message={error} title="Sign-in link could not be sent" variant="error" />
        ) : null}

        <View style={styles.form}>
          <TextField
            accessibilityLabel="Email Address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!loading && mobileServices.auth.isConfigured}
            errorText={fieldError}
            keyboardType="email-address"
            label="Email Address"
            onChangeText={(value) => {
              setEmail(value);
              if (fieldError) setFieldError(undefined);
              if (error) setError(null);
            }}
            placeholder="you@example.com"
            required
            value={email}
          />
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            accessibilityHint="Sends a secure passwordless sign-in link to your email."
            accessibilityLabel="Send sign-in link"
            disabled={!mobileServices.auth.isConfigured}
            loading={loading}
            onPress={handleSendLink}
          >
            {loading ? "Sending link..." : "Send sign-in link"}
          </PrimaryButton>

          <PrimaryButton
            accessibilityHint="Returns to the previous screen."
            disabled={loading}
            variant="ghost"
            onPress={() => router.back()}
          >
            Back
          </PrimaryButton>
        </View>

        <View style={styles.adminFooter}>
          <Text style={styles.adminFooterText}>
            Administrator?{" "}
            <Text
              style={styles.adminLink}
              onPress={() => router.push("/admin-login")}
            >
              Sign in to Console
            </Text>
          </Text>
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
  form: {
    marginVertical: spacing.md,
  },
  actions: {
    gap: spacing.xs,
  },
  adminFooter: {
    alignItems: "center",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  adminFooterText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  adminLink: {
    color: colors.primaryDark,
    fontWeight: "600",
  },
});
