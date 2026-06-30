import { StyleSheet, Text, View } from "react-native";
import { NotificationPermissionStatus } from "../../application/notifications/NotificationPermission";
import { PushRegistrationAvailability } from "../../application/services/PushRegistrationService";
import { Card } from "../../components/Card";
import { Banner } from "../../components/Banner";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SectionHeader } from "../../components/SectionHeader";
import { StatusChip } from "../../components/StatusChip";
import type { PushNotificationRegistrationState } from "../hooks/usePushNotificationRegistration";
import { colors, spacing, typography } from "../../theme/tokens";

const permissionLabels: Readonly<Record<NotificationPermissionStatus, string>> = {
  [NotificationPermissionStatus.Denied]: "denied",
  [NotificationPermissionStatus.Ephemeral]: "ephemeral",
  [NotificationPermissionStatus.Granted]: "granted",
  [NotificationPermissionStatus.NotDetermined]: "not requested",
  [NotificationPermissionStatus.Provisional]: "provisional",
  [NotificationPermissionStatus.Unsupported]: "unsupported",
};

type PushNotificationRegistrationCardProps = {
  pushPreferenceEnabled: boolean;
  registration: PushNotificationRegistrationState;
};

export function PushNotificationRegistrationCard({
  pushPreferenceEnabled,
  registration,
}: PushNotificationRegistrationCardProps) {
  const available =
    registration.availability === PushRegistrationAvailability.Available;
  const permissionLabel = registration.permissionStatus
    ? permissionLabels[registration.permissionStatus]
    : "not checked";

  return (
    <Card variant="outlined">
      <SectionHeader
        action={<StatusChip label="Experimental" tone="warning" />}
        subtitle="Optionally register this app installation for controlled development testing. This does not activate push delivery."
        title="Device notifications"
      />

      <Banner
        compact
        message="Karri requests platform permission only after you press the button below. No token is displayed, logged, or written directly to Firestore."
        title="User initiated only"
        variant="development"
      />

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Platform permission</Text>
        <StatusChip
          label={permissionLabel}
          tone={
            registration.permissionStatus === NotificationPermissionStatus.Granted
              ? "success"
              : "neutral"
          }
        />
      </View>

      {!pushPreferenceEnabled ? (
        <Text style={styles.help}>
          Enable Push above and save preferences before registering this device.
        </Text>
      ) : null}
      {!available ? (
        <Text style={styles.help}>
          Requires an Android or iOS development build with a configured EAS project ID.
        </Text>
      ) : null}

      {registration.message ? (
        <Banner
          compact
          message={registration.message}
          title={
            registration.outcome === "success"
              ? "Registration confirmed"
              : "Registration deferred"
          }
          variant={registration.outcome === "success" ? "success" : "warning"}
        />
      ) : null}

      <PrimaryButton
        disabled={!pushPreferenceEnabled || !available}
        loading={registration.busy}
        onPress={() => void registration.register()}
      >
        Enable device notifications
      </PrimaryButton>
    </Card>
  );
}

const styles = StyleSheet.create({
  help: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  statusLabel: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
});
