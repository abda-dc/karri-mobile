import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { LoadingState } from "../../src/components/LoadingState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import { TrustBadge } from "../../src/components/TrustBadge";
import type { Booking } from "../../src/domain/booking/Booking";
import {
  NotificationStatus,
  type Notification,
} from "../../src/domain/notification/Notification";
import { NotificationPreferencesCard } from "../../src/presentation/components/NotificationPreferencesCard";
import { PushNotificationRegistrationCard } from "../../src/presentation/components/PushNotificationRegistrationCard";
import { TrustSummaryCard } from "../../src/presentation/components/TrustSummaryCard";
import { useNotificationPreferences } from "../../src/presentation/hooks/useNotificationPreferences";
import { usePushNotificationRegistration } from "../../src/presentation/hooks/usePushNotificationRegistration";
import { reportFriendlyError } from "../../src/presentation/errors/getFriendlyError";
import { useAuthSession } from "../../src/presentation/hooks/useAuthSession";
import { mobileServices } from "../../src/presentation/services/mobileServices";
import { colors, spacing, typography } from "../../src/theme/tokens";

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Pending timestamp";
}

export default function ProfileScreen() {
  const auth = useAuthSession();
  const [bookings, setBookings] = useState<ReadonlyArray<Booking>>([]);
  const [notifications, setNotifications] = useState<ReadonlyArray<Notification>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingReadIds, setPendingReadIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const notificationPreferences = useNotificationPreferences(auth.user?.uid ?? null);
  const pushRegistration = usePushNotificationRegistration(
    auth.user?.uid ?? null,
    notificationPreferences.preferences,
  );

  useEffect(() => {
    if (auth.loading) {
      return;
    }

    if (!auth.user) {
      setLoading(false);
      setBookings([]);
      setNotifications([]);
      setPendingReadIds(new Set());
      return;
    }

    setLoading(true);
    setError(null);
    let bookingReady = false;
    let notificationReady = false;
    const markReady = () => {
      if (bookingReady && notificationReady) {
        setLoading(false);
      }
    };

    try {
      const unsubscribeBookings = mobileServices.booking.watchForParticipant(
        auth.user.uid,
        (nextBookings) => {
          setBookings(nextBookings);
          bookingReady = true;
          markReady();
        },
        (watchError) => {
          setError(reportFriendlyError(watchError, "profile.watch-bookings"));
          setLoading(false);
        },
      );
      const unsubscribeNotifications = mobileServices.notification.watchForRecipient(
        auth.user.uid,
        (nextNotifications) => {
          setNotifications(nextNotifications);
          notificationReady = true;
          markReady();
        },
        (watchError) => {
          setError(reportFriendlyError(watchError, "profile.watch-notifications"));
          setLoading(false);
        },
      );

      return () => {
        unsubscribeBookings();
        unsubscribeNotifications();
      };
    } catch (watchError) {
      setError(reportFriendlyError(watchError, "profile.start-activity-watches"));
      setLoading(false);
      return;
    }
  }, [auth.loading, auth.user]);

  async function markRead(notificationId: string) {
    if (pendingReadIds.has(notificationId)) {
      return;
    }

    setPendingReadIds((current) => new Set(current).add(notificationId));
    setError(null);
    try {
      await mobileServices.notification.markRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                readAt: notification.readAt ?? new Date().toISOString(),
                status: NotificationStatus.Read,
              }
            : notification,
        ),
      );
    } catch (markError) {
      setError(reportFriendlyError(markError, "profile.mark-notification-read"));
    } finally {
      setPendingReadIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
    }
  }

  const unreadCount = notifications.filter(
    (notification) =>
      notification.status === NotificationStatus.Unread &&
      !pendingReadIds.has(notification.id),
  ).length;

  return (
    <Screen contentStyle={styles.page} withTabBar>
      <SectionHeader
        action={<StatusChip label={auth.user?.isAnonymous ? "MVP session" : "Signed in"} tone="info" />}
        eyebrow="Profile and trust"
        subtitle="Understand the evidence behind your Karri history and current activity."
        title="Your Karri identity"
      />

      <TrustBadge
        detail="Trust is a bounded summary of eligible history, not a guarantee of safety."
        label="Explainable trust"
      />

      {auth.loading || loading ? (
        <LoadingState message="Loading profile activity..." />
      ) : null}

      {!auth.loading && !auth.user ? (
        <EmptyState
          action={<PrimaryButton onPress={() => router.push("/login")}>Get started</PrimaryButton>}
          description="Start a Karri session to view trust history and notifications."
          marker="P"
          title="Sign in to view your profile"
        />
      ) : null}

      {error ? <Banner message={error} title="Profile activity issue" variant="error" /> : null}

      {auth.user ? (
        <>
          <TrustSummaryCard
            accountCreatedAt={auth.user.createdAt}
            bookings={bookings}
            refreshKey={notifications.length}
            title="Your trust score"
            userId={auth.user.uid}
          />

          <Card variant="outlined">
            <SectionHeader
              action={<StatusChip label={`${unreadCount} unread`} tone={unreadCount ? "warning" : "neutral"} />}
              subtitle="In-app records created from booking, custody, and review events."
              title="Notifications"
            />

            {notifications.length === 0 ? (
              <Text style={styles.muted}>No in-app notifications yet.</Text>
            ) : (
              <View style={styles.notifications}>
                {notifications.map((notification) => {
                  const readPending = pendingReadIds.has(notification.id);

                  return (
                    <View key={notification.id} style={styles.notificationRow}>
                      <View style={styles.notificationCopy}>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        <Text style={styles.muted}>{notification.body}</Text>
                        <Text style={styles.muted}>{formatTimestamp(notification.createdAt)}</Text>
                      </View>
                      {readPending ? (
                        <StatusChip label="Read pending" tone="info" />
                      ) : notification.status === NotificationStatus.Unread ? (
                        <PrimaryButton
                          style={styles.readButton}
                          variant="ghost"
                          onPress={() => markRead(notification.id)}
                        >
                          Mark read
                        </PrimaryButton>
                      ) : (
                        <StatusChip label="Read" tone="neutral" />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          {notificationPreferences.preferences ? (
            <>
              <NotificationPreferencesCard
                loading={notificationPreferences.loading}
                preferences={notificationPreferences.preferences}
                onSave={notificationPreferences.updatePreferences}
              />
              <PushNotificationRegistrationCard
                pushPreferenceEnabled={
                  notificationPreferences.preferences.channels.push
                }
                registration={pushRegistration}
              />
            </>
          ) : null}

          <Card variant="elevated">
            <SectionHeader
              subtitle="Profile editing remains a separate setup flow."
              title="Profile details"
            />
            <Banner
              compact
              message="This anonymous MVP session has no identity verification credit."
              title="Verification: none"
              variant="development"
            />
            <PrimaryButton variant="secondary" onPress={() => router.push("/profile-setup")}>
              Review profile setup
            </PrimaryButton>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.xl,
  },
  muted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  notifications: {
    gap: spacing.md,
  },
  notificationRow: {
    alignItems: "flex-start",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  notificationCopy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 210,
  },
  notificationTitle: {
    color: colors.text,
    ...typography.label,
  },
  readButton: {
    minHeight: 40,
  },
});
