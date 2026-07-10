import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner } from "../src/components/Banner";
import { Card } from "../src/components/Card";
import { EmptyState } from "../src/components/EmptyState";
import { LoadingState } from "../src/components/LoadingState";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { TextField } from "../src/components/TextField";
import { TrustBadge } from "../src/components/TrustBadge";
import { DomainValidationError } from "../src/application/services/validation";
import type { Profile, UserRole } from "../src/domain/profile/Profile";
import { reportFriendlyError } from "../src/presentation/errors/getFriendlyError";
import { useAuthSession } from "../src/presentation/hooks/useAuthSession";
import { mobileServices } from "../src/presentation/services/mobileServices";
import { colors, radii, spacing, touchTargets, typography } from "../src/theme/tokens";

type FieldErrors = Partial<
  Record<"displayName" | "homeRegion" | "primaryDestinationCountry", string>
>;

const roleOptions: ReadonlyArray<{
  readonly description: string;
  readonly label: string;
  readonly value: UserRole;
}> = [
  {
    description: "I plan to send items with trusted travelers.",
    label: "Sender",
    value: "sender",
  },
  {
    description: "I plan to carry items on trips I already take.",
    label: "Traveler",
    value: "traveler",
  },
];

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export default function ProfileSetupScreen() {
  const auth = useAuthSession();
  const [displayName, setDisplayName] = useState("");
  const [homeRegion, setHomeRegion] = useState("");
  const [primaryDestinationCountry, setPrimaryDestinationCountry] = useState("");
  const [roles, setRoles] = useState<ReadonlyArray<UserRole>>([]);
  const [existingProfile, setExistingProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading || !auth.user) {
      return;
    }

    let active = true;
    setLoadingProfile(true);
    setProfileReady(false);
    setLoadError(null);

    mobileServices.profile
      .findByUserId(auth.user.uid)
      .then((profile) => {
        if (!active) {
          return;
        }

        setExistingProfile(profile);
        if (profile) {
          setDisplayName(profile.displayName);
          setHomeRegion(profile.homeRegion);
          setPrimaryDestinationCountry(profile.primaryDestinationCountry);
          setRoles(profile.roles);
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(
            reportFriendlyError(error, "profile-setup.load-profile"),
          );
        }
      })
      .finally(() => {
        if (active) {
          setProfileReady(true);
          setLoadingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, [auth.loading, auth.user, retryKey]);

  function toggleRole(role: UserRole) {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((selectedRole) => selectedRole !== role)
        : [...current, role],
    );
    setFormError(null);
  }

  function validateForm(): {
    displayName: string;
    homeRegion: string;
    primaryDestinationCountry: string;
  } | null {
    const nextFieldErrors: FieldErrors = {};
    const cleanedDisplayName = normalizeText(displayName);
    const cleanedHomeRegion = normalizeText(homeRegion);
    const cleanedPrimaryDestinationCountry = normalizeText(
      primaryDestinationCountry,
    );

    if (!cleanedDisplayName) {
      nextFieldErrors.displayName = "Full name is required.";
    }
    if (!cleanedHomeRegion) {
      nextFieldErrors.homeRegion = "Home region is required.";
    }
    if (!cleanedPrimaryDestinationCountry) {
      nextFieldErrors.primaryDestinationCountry =
        "Primary destination country is required.";
    }

    setFieldErrors(nextFieldErrors);
    if (roles.length === 0) {
      setFormError("Select at least one role interest.");
    } else {
      setFormError(null);
    }

    if (Object.keys(nextFieldErrors).length > 0 || roles.length === 0) {
      return null;
    }

    return {
      displayName: cleanedDisplayName,
      homeRegion: cleanedHomeRegion,
      primaryDestinationCountry: cleanedPrimaryDestinationCountry,
    };
  }

  async function handleSave() {
    if (saving || !auth.user) {
      return;
    }

    const validFields = validateForm();
    if (!validFields) {
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await mobileServices.profile.saveProfile({
        ...validFields,
        roles,
        userId: auth.user.uid,
      });
      router.replace("/(tabs)/home");
    } catch (error) {
      setFormError(
        error instanceof DomainValidationError
          ? error.message
          : reportFriendlyError(error, "profile-setup.save-profile"),
      );
    } finally {
      setSaving(false);
    }
  }

  if (auth.loading) {
    return (
      <Screen centered contentStyle={styles.content}>
        <LoadingState message="Checking your Karri account..." />
      </Screen>
    );
  }

  if (!auth.user) {
    return (
      <Screen centered contentStyle={styles.content}>
        <EmptyState
          action={
            <PrimaryButton
              accessibilityHint="Returns to the welcome screen to start account setup."
              onPress={() => router.replace("/")}
            >
              Return to welcome
            </PrimaryButton>
          }
          description={
            auth.error ??
            "Start a temporary Karri account before completing your profile."
          }
          title="Account setup needed"
        />
      </Screen>
    );
  }

  const isEditing = Boolean(existingProfile);
  const checkingProfile = loadingProfile || !profileReady;

  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader
        eyebrow="Profile setup"
        subtitle="A clear profile helps senders and travelers understand who they are coordinating with."
        title={isEditing ? "Update your Karri profile" : "Complete your Karri profile"}
      />

      <TrustBadge
        detail="Profile details support clearer coordination. Identity verification and trust scoring are separate."
        label="Trust grows with clarity"
      />

      <Card variant="elevated">
        {checkingProfile ? (
          <SectionHeader
            subtitle="Checking whether this account already has profile details."
            title="Loading profile"
          />
        ) : null}

        {loadError ? (
          <>
            <Banner message={loadError} title="Profile could not load" variant="error" />
            <PrimaryButton
              accessibilityHint="Tries to load your profile details again."
              onPress={() => setRetryKey((current) => current + 1)}
            >
              Retry profile
            </PrimaryButton>
          </>
        ) : null}

        {!checkingProfile && !loadError ? (
          <>
            <SectionHeader
              subtitle="Use details you are comfortable showing in Karri."
              title="About you"
            />
            <TextField
              errorText={fieldErrors.displayName}
              helperText="Use the name senders and travelers should recognize."
              label="Full name"
              onChangeText={(value) => {
                setDisplayName(value);
                setFieldErrors((current) => ({ ...current, displayName: undefined }));
              }}
              placeholder="Your legal or preferred name"
              required
              value={displayName}
            />
            <TextField
              errorText={fieldErrors.homeRegion}
              helperText="Share the city, state, or region you usually coordinate from."
              label="Home region"
              onChangeText={(value) => {
                setHomeRegion(value);
                setFieldErrors((current) => ({ ...current, homeRegion: undefined }));
              }}
              placeholder="Washington, DC"
              required
              value={homeRegion}
            />
            <TextField
              errorText={fieldErrors.primaryDestinationCountry}
              helperText="Choose the country you most often send to or travel toward."
              label="Primary destination country"
              onChangeText={(value) => {
                setPrimaryDestinationCountry(value);
                setFieldErrors((current) => ({
                  ...current,
                  primaryDestinationCountry: undefined,
                }));
              }}
              placeholder="Ethiopia, Kenya, Uganda..."
              required
              value={primaryDestinationCountry}
            />

            <View style={styles.roles}>
              <SectionHeader
                subtitle="Choose one role, or both. You can update this later."
                title="Role interests"
              />
              <View style={styles.roleRow}>
                {roleOptions.map((role) => {
                  const selected = roles.includes(role.value);
                  return (
                    <Pressable
                      accessibilityHint={`Toggles ${role.label} as a profile role interest.`}
                      accessibilityLabel={`${role.label} role`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled: saving }}
                      disabled={saving}
                      hitSlop={touchTargets.hitSlop}
                      key={role.value}
                      onPress={() => toggleRole(role.value)}
                      style={({ pressed }) => [
                        styles.roleOption,
                        selected && styles.roleOptionSelected,
                        pressed && !saving && styles.pressed,
                        saving && styles.disabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleTitle,
                          selected && styles.roleTitleSelected,
                        ]}
                      >
                        {role.label}
                      </Text>
                      <Text
                        style={[
                          styles.roleDescription,
                          selected && styles.roleDescriptionSelected,
                        ]}
                      >
                        {role.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Banner
              compact
              message="Profile details help people coordinate clearly. Identity verification is separate, and profile completion does not automatically change your trust score."
              title="Share with care"
              variant="info"
            />

            {formError ? (
              <Banner message={formError} title="Profile issue" variant="error" />
            ) : null}

            <View style={styles.actions}>
              <PrimaryButton
                accessibilityHint="Saves your profile details and opens Karri home."
                loading={saving}
                onPress={handleSave}
              >
                {saving
                  ? "Saving profile..."
                  : isEditing
                    ? "Update profile"
                    : "Complete profile"}
              </PrimaryButton>
              <PrimaryButton
                accessibilityHint="Returns to the previous screen without saving profile changes."
                disabled={saving}
                variant="ghost"
                onPress={() => router.back()}
              >
                Back
              </PrimaryButton>
            </View>
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.xs,
  },
  content: {
    gap: spacing.xl,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  roleDescription: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  roleDescriptionSelected: {
    color: colors.primaryDark,
  },
  roleOption: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: 150,
    flexGrow: 1,
    gap: spacing.xxs,
    minHeight: touchTargets.large,
    padding: spacing.md,
  },
  roleOptionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roleTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  roleTitleSelected: {
    color: colors.primaryDark,
  },
  roles: {
    gap: spacing.sm,
  },
});
