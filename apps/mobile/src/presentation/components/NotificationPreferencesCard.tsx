import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner } from "../../components/Banner";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SectionHeader } from "../../components/SectionHeader";
import { StatusChip } from "../../components/StatusChip";
import { TextField } from "../../components/TextField";
import {
  NotificationChannel,
  NotificationPreferenceCategory,
  type NotificationPreferences,
  type QuietHours,
} from "../../domain/notification/NotificationPreferences";
import { colors, radii, spacing, touchTargets, typography } from "../../theme/tokens";

const categoryLabels: Readonly<Record<NotificationPreferenceCategory, string>> = {
  [NotificationPreferenceCategory.BookingRequests]: "Booking requests",
  [NotificationPreferenceCategory.BookingUpdates]: "Booking updates",
  [NotificationPreferenceCategory.CustodyUpdates]: "Custody handoffs",
  [NotificationPreferenceCategory.DeliveryUpdates]: "Delivery updates",
  [NotificationPreferenceCategory.GeneralAnnouncements]: "General announcements",
  [NotificationPreferenceCategory.ReviewReminders]: "Review reminders",
  [NotificationPreferenceCategory.TrustProfileAlerts]: "Trust and profile alerts",
};

const categoryDescriptions: Readonly<Record<NotificationPreferenceCategory, string>> = {
  [NotificationPreferenceCategory.BookingRequests]: "New requests to carry or send an item.",
  [NotificationPreferenceCategory.BookingUpdates]: "Accepted, declined, cancelled, and completed bookings.",
  [NotificationPreferenceCategory.CustodyUpdates]: "Pickup, handoff, and sealed custody timeline changes.",
  [NotificationPreferenceCategory.DeliveryUpdates]: "Delivered item and final status updates.",
  [NotificationPreferenceCategory.GeneralAnnouncements]: "Community and platform notices.",
  [NotificationPreferenceCategory.ReviewReminders]: "Prompts to review after a completed delivery.",
  [NotificationPreferenceCategory.TrustProfileAlerts]: "Trust badge, profile, and safety-related changes.",
};

const channelLabels: Readonly<Record<NotificationChannel, string>> = {
  [NotificationChannel.Email]: "Email",
  [NotificationChannel.Push]: "Push",
  [NotificationChannel.Sms]: "SMS",
};

const channelDescriptions: Readonly<Record<NotificationChannel, string>> = {
  [NotificationChannel.Email]: "Reserved for future email alerts.",
  [NotificationChannel.Push]: "Prepared for future device notifications in this app.",
  [NotificationChannel.Sms]: "Reserved for future SMS alerts.",
};

const preferenceCategories = Object.values(NotificationPreferenceCategory);
const notificationChannels = Object.values(NotificationChannel);

type NotificationPreferencesCardProps = {
  loading?: boolean;
  onSave(preferences: NotificationPreferences): Promise<NotificationPreferences>;
  preferences: NotificationPreferences;
};

type AvailabilityTone = "active" | "info" | "neutral" | "success" | "warning";

export function NotificationPreferencesCard({
  loading = false,
  onSave,
  preferences,
}: NotificationPreferencesCardProps) {
  const [draft, setDraft] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(preferences);
    setError(null);
  }, [preferences]);

  const hasChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(preferences),
    [draft, preferences],
  );

  function toggleCategory(category: NotificationPreferenceCategory) {
    setDraft((current) => ({
      ...current,
      categories: {
        ...current.categories,
        [category]: !current.categories[category],
      },
    }));
  }

  function togglePushChannel() {
    setDraft((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [NotificationChannel.Push]: !current.channels[NotificationChannel.Push],
      },
    }));
  }

  function setQuietHours(nextQuietHours: QuietHours | null) {
    setDraft((current) => ({
      ...current,
      quietHours: nextQuietHours,
    }));
  }

  function updateQuietHoursField(field: keyof QuietHours, value: string) {
    const currentQuietHours =
      draft.quietHours ??
      ({
        startLocalTime: "22:00",
        endLocalTime: "07:00",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      } satisfies QuietHours);

    setQuietHours({
      ...currentQuietHours,
      [field]: value,
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await onSave(draft);
      setDraft(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="outlined">
      <SectionHeader
        action={<StatusChip label="Foundation" tone="info" />}
        subtitle="Choose what Karri should be allowed to notify you about later. Push delivery is not active yet."
        title="Notification preferences"
      />

      {error ? (
        <Banner
          compact
          message={error}
          title="Preference issue"
          variant="error"
        />
      ) : null}

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Channels</Text>
        {notificationChannels.map((channel) => {
          const available = channel === NotificationChannel.Push;
          const enabled = draft.channels[channel];

          return (
            <PreferenceToggleRow
              key={channel}
              availabilityLabel={available ? "Preference available" : "Coming later"}
              availabilityTone={available ? "success" : "neutral"}
              description={channelDescriptions[channel]}
              disabled={!available || loading || saving}
              enabled={enabled}
              featured={available}
              label={channelLabels[channel]}
              onPress={channel === NotificationChannel.Push ? togglePushChannel : undefined}
            />
          );
        })}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Updates</Text>
        {preferenceCategories.map((category) => (
          <PreferenceToggleRow
            key={category}
            description={categoryDescriptions[category]}
            disabled={loading || saving}
            enabled={draft.categories[category]}
            label={categoryLabels[category]}
            onPress={() => toggleCategory(category)}
          />
        ))}
      </View>

      <View style={styles.group}>
        <View style={styles.rowHeader}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Quiet hours</Text>
            <Text style={styles.rowDescription}>
              Keep a local do-not-disturb window ready for future push delivery.
            </Text>
          </View>
          <PrimaryButton
            disabled={loading || saving}
            variant="ghost"
            onPress={() =>
              draft.quietHours
                ? setQuietHours(null)
                : setQuietHours({
                    startLocalTime: "22:00",
                    endLocalTime: "07:00",
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                  })
            }
          >
            {draft.quietHours ? "Disable" : "Enable"}
          </PrimaryButton>
        </View>

        {draft.quietHours ? (
          <View style={styles.quietHoursPanel}>
            <View style={styles.quietHoursSummary}>
              <StatusChip label="Local window" tone="info" />
              <Text style={styles.quietHoursSummaryText}>
                {draft.quietHours.startLocalTime} to {draft.quietHours.endLocalTime}
              </Text>
            </View>
            <View style={styles.quietHoursFields}>
              <TextField
                containerStyle={styles.quietHoursField}
                helperText="Use 24-hour HH:mm format."
                label="Start"
                value={draft.quietHours.startLocalTime}
                onChangeText={(value) => updateQuietHoursField("startLocalTime", value)}
              />
              <TextField
                containerStyle={styles.quietHoursField}
                helperText="Use 24-hour HH:mm format."
                label="End"
                value={draft.quietHours.endLocalTime}
                onChangeText={(value) => updateQuietHoursField("endLocalTime", value)}
              />
            </View>
            <TextField
              helperText="Example: America/New_York"
              label="Time zone"
              value={draft.quietHours.timeZone}
              onChangeText={(value) => updateQuietHoursField("timeZone", value)}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          disabled={!hasChanges || loading || saving}
          loading={saving}
          onPress={save}
        >
          Save preferences
        </PrimaryButton>
        <PrimaryButton
          disabled={!hasChanges || loading || saving}
          variant="secondary"
          onPress={() => {
            setDraft(preferences);
            setError(null);
          }}
        >
          Reset
        </PrimaryButton>
      </View>
    </Card>
  );
}

type PreferenceToggleRowProps = {
  availabilityLabel?: string;
  availabilityTone?: AvailabilityTone;
  description: string;
  disabled?: boolean;
  enabled: boolean;
  featured?: boolean;
  label: string;
  onPress?: () => void;
};

function PreferenceToggleRow({
  availabilityLabel,
  availabilityTone = "neutral",
  description,
  disabled = false,
  enabled,
  featured = false,
  label,
  onPress,
}: PreferenceToggleRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      hitSlop={touchTargets.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleRow,
        featured && styles.featuredToggleRow,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{label}</Text>
          {availabilityLabel ? (
            <StatusChip label={availabilityLabel} tone={availabilityTone} />
          ) : null}
        </View>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <View style={[styles.switchTrack, enabled && styles.switchTrackEnabled]}>
        <View style={[styles.switchThumb, enabled && styles.switchThumbEnabled]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  disabled: {
    opacity: 0.55,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    color: colors.text,
    ...typography.label,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
  featuredToggleRow: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  quietHoursField: {
    flexBasis: 132,
    flexGrow: 1,
  },
  quietHoursFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quietHoursPanel: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  quietHoursSummary: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  quietHoursSummaryText: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowDescription: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  rowTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  rowTitleLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  switchThumb: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 20,
    width: 20,
  },
  switchThumbEnabled: {
    transform: [{ translateX: 22 }],
  },
  switchTrack: {
    backgroundColor: colors.borderStrong,
    borderRadius: radii.pill,
    padding: spacing.xxs,
    width: 50,
  },
  switchTrackEnabled: {
    backgroundColor: colors.primary,
  },
  toggleRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: touchTargets.large,
    padding: spacing.md,
  },
});
