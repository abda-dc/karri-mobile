import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApplicationError, ApplicationErrorCode } from "../src/application/errors/ApplicationError";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { LoadingState } from "../src/components/LoadingState";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { TextField } from "../src/components/TextField";
import { TrustBadge } from "../src/components/TrustBadge";
import { getFriendlyError } from "../src/presentation/errors/getFriendlyError";
import { useAuthSession } from "../src/presentation/hooks/useAuthSession";
import { mobileServices } from "../src/presentation/services/mobileServices";
import { colors, spacing, typography } from "../src/theme/tokens";

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string; link?: string }>();
  const incomingUrl = Linking.useURL();
  const authSession = useAuthSession();

  const [targetEmail, setTargetEmail] = useState<string>(params.email ?? "");
  const [manualLink, setManualLink] = useState<string>("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collisionError, setCollisionError] = useState<string | null>(null);

  const attemptedUrlsRef = useRef<Set<string>>(new Set());

  // Load pending email from storage if not in params
  useEffect(() => {
    if (!targetEmail) {
      void mobileServices.auth.getPendingEmail().then((pending) => {
        if (pending) {
          setTargetEmail(pending);
        }
      });
    }
  }, [targetEmail]);

  const handleCompleteVerification = useCallback(
    async (linkToVerify: string, emailToUse?: string) => {
      if (verifying) return;

      const cleanLink = linkToVerify.trim();
      if (!cleanLink || !mobileServices.auth.isSignInWithEmailLink(cleanLink)) {
        setError("The provided link is not a valid Karri sign-in link.");
        return;
      }

      const email = (emailToUse || targetEmail || "").trim().toLowerCase();
      if (!email) {
        setError("Please enter or confirm your email address to complete verification.");
        setShowManualEntry(true);
        return;
      }

      setVerifying(true);
      setError(null);
      setCollisionError(null);

      try {
        const { session } = await mobileServices.auth.completeEmailLinkSignIn(
          cleanLink,
          email,
        );

        // Check if user has an existing profile
        try {
          const profile = await mobileServices.profile.findByUserId(session.identity.uid);
          if (profile) {
            router.replace("/(tabs)/home");
            return;
          }
        } catch {
          // If profile lookup fails, route safely to profile-setup
        }

        router.replace("/profile-setup");
      } catch (err: unknown) {
        if (
          err instanceof ApplicationError &&
          err.code === ApplicationErrorCode.Conflict
        ) {
          setCollisionError(
            err.message +
              " " +
              (err.retryGuidance ??
                "Sign in to your existing account, or choose a different email."),
          );
        } else {
          setError(getFriendlyError(err));
        }
      } finally {
        setVerifying(false);
      }
    },
    [targetEmail, verifying],
  );

  // Auto-verify when link arrives via route params or deep linking
  useEffect(() => {
    const candidateLink = params.link || incomingUrl;
    if (
      candidateLink &&
      mobileServices.auth.isSignInWithEmailLink(candidateLink) &&
      !attemptedUrlsRef.current.has(candidateLink) &&
      !verifying
    ) {
      attemptedUrlsRef.current.add(candidateLink);
      void handleCompleteVerification(candidateLink);
    }
  }, [incomingUrl, params.link, handleCompleteVerification, verifying]);

  async function handleResend() {
    const email = targetEmail.trim().toLowerCase();
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    setResending(true);
    setError(null);
    setResendSuccess(false);
    try {
      await mobileServices.auth.sendSignInLinkToEmail(email);
      setResendSuccess(true);
    } catch (err: unknown) {
      setError(getFriendlyError(err));
    } finally {
      setResending(false);
    }
  }

  async function handleSwitchToExistingAccount() {
    // If collision occurs on anonymous user, sign out anonymous user and redirect to login
    try {
      await mobileServices.auth.signOut();
      router.replace("/login");
    } catch {
      router.replace("/login");
    }
  }

  if (verifying) {
    return (
      <Screen centered contentStyle={styles.content}>
        <LoadingState message="Verifying your secure sign-in link..." />
      </Screen>
    );
  }

  return (
    <Screen centered contentStyle={styles.content}>
      <SectionHeader
        eyebrow="Email Verification"
        subtitle="Open the secure link sent to your email to authenticate and preserve your account identity."
        title="Check your email"
      />

      <Card variant="elevated">
        <TrustBadge
          detail="Karri uses secure passwordless email links to establish recoverable customer identities without storing passwords."
          label="Passwordless security"
        />

        {targetEmail ? (
          <View style={styles.emailBox}>
            <Text style={styles.emailLabel}>Sign-in link sent to:</Text>
            <Text style={styles.emailValue}>{targetEmail}</Text>
          </View>
        ) : null}

        {resendSuccess ? (
          <Banner
            compact
            message="A new sign-in link has been sent to your email address."
            title="Link sent"
            variant="info"
          />
        ) : null}

        {collisionError ? (
          <Banner
            message={collisionError}
            title="Account already exists"
            variant="warning"
          />
        ) : error ? (
          <Banner message={error} title="Verification issue" variant="error" />
        ) : null}

        {collisionError ? (
          <View style={styles.actions}>
            <PrimaryButton
              accessibilityHint="Signs in with your existing account instead of linking to this temporary session."
              onPress={handleSwitchToExistingAccount}
            >
              Sign in to existing account
            </PrimaryButton>
            <PrimaryButton
              accessibilityHint="Try linking with a different email address."
              variant="secondary"
              onPress={() => router.replace("/login")}
            >
              Use a different email
            </PrimaryButton>
          </View>
        ) : (
          <>
            <View style={styles.instructions}>
              <Text style={styles.instructionText}>
                1. Open your email inbox on this device.{"\n"}
                2. Tap the link in the email from Karri.{"\n"}
                3. You will return here and be automatically signed in.
              </Text>
            </View>

            {showManualEntry ? (
              <View style={styles.manualEntryContainer}>
                {!targetEmail ? (
                  <TextField
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    label="Confirm Email Address"
                    onChangeText={setTargetEmail}
                    placeholder="you@example.com"
                    value={targetEmail}
                  />
                ) : null}
                <TextField
                  autoCapitalize="none"
                  autoCorrect={false}
                  label="Sign-in Link"
                  onChangeText={setManualLink}
                  placeholder="Paste the link from your email"
                  value={manualLink}
                />
                <Text style={styles.troubleshootNotice}>
                  Manual entry is for troubleshooting only if your email client does not automatically open Karri. Do not share sign-in links.
                </Text>
                <PrimaryButton
                  accessibilityHint="Submits pasted link for verification."
                  disabled={!manualLink.trim()}
                  onPress={() => {
                    const linkToVerify = manualLink;
                    setManualLink("");
                    setShowManualEntry(false);
                    void handleCompleteVerification(linkToVerify);
                  }}
                >
                  Verify pasted link
                </PrimaryButton>
              </View>
            ) : null}

            <View style={styles.actions}>
              <PrimaryButton
                accessibilityHint="Requests a new sign-in link if the previous one didn't arrive."
                disabled={resending || !targetEmail}
                loading={resending}
                variant="secondary"
                onPress={handleResend}
              >
                {resending ? "Sending new link..." : "Resend sign-in link"}
              </PrimaryButton>

              <PrimaryButton
                accessibilityHint="Toggle manual link entry if automatic deep linking didn't work."
                variant="ghost"
                onPress={() => setShowManualEntry((prev) => !prev)}
              >
                {showManualEntry ? "Hide troubleshooting" : "Troubleshoot sign-in link"}
              </PrimaryButton>

              <PrimaryButton
                accessibilityHint="Returns to login to enter a different email address."
                variant="ghost"
                onPress={() => router.replace("/login")}
              >
                Use a different email
              </PrimaryButton>
            </View>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  emailBox: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  emailLabel: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  emailValue: {
    color: colors.text,
    ...typography.bodyStrong,
    marginTop: spacing.xxs,
  },
  instructions: {
    marginVertical: spacing.sm,
  },
  instructionText: {
    color: colors.textSecondary,
    ...typography.body,
    lineHeight: 22,
  },
  manualEntryContainer: {
    gap: spacing.sm,
    marginVertical: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  troubleshootNotice: {
    color: colors.textSecondary,
    ...typography.caption,
    lineHeight: 18,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
