import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { DashboardHeaderImage } from "../../src/components/DashboardHeaderImage";
import { EmptyState } from "../../src/components/EmptyState";
import { LoadingState } from "../../src/components/LoadingState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import type { Booking } from "../../src/domain/booking/Booking";
import {
  NotificationStatus,
  type Notification,
} from "../../src/domain/notification/Notification";
import { NotificationPreferencesCard } from "../../src/presentation/components/NotificationPreferencesCard";
import { PushNotificationRegistrationCard } from "../../src/presentation/components/PushNotificationRegistrationCard";
import { TrustSummaryCard } from "../../src/presentation/components/TrustSummaryCard";
import { VerificationChecklist } from "../../src/presentation/components/VerificationChecklist";
import { VerificationStatusCard } from "../../src/presentation/components/VerificationStatusCard";
import { VerificationTimeline } from "../../src/presentation/components/VerificationTimeline";
import { useIdentityVerification } from "../../src/presentation/hooks/useIdentityVerification";
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
  const [activityRetryKey, setActivityRetryKey] = useState(0);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [pendingReadIds, setPendingReadIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const notificationPreferences = useNotificationPreferences(auth.user?.uid ?? null);
  const identityVerification = useIdentityVerification(auth.user?.uid ?? null);
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
        setError(null);
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
  }, [activityRetryKey, auth.loading, auth.user]);

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

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setSessionError(null);
    try {
      await mobileServices.auth.signOut();
      router.replace("/");
    } catch (signOutError) {
      setSessionError(reportFriendlyError(signOutError, "profile.sign-out"));
    } finally {
      setSigningOut(false);
    }
  }

  const unreadCount = notifications.filter(
    (notification) =>
      notification.status === NotificationStatus.Unread &&
      !pendingReadIds.has(notification.id),
  ).length;
  const hasSessionProfileActivity = bookings.length > 0 || notifications.length > 0;
  const showingStaleProfileActivity = error !== null && hasSessionProfileActivity;

  return (
    <Screen contentStyle={styles.page} withTabBar>
      <SectionHeader
        action={<StatusChip label={auth.user?.isAnonymous ? "MVP session" : "Signed in"} tone="info" />}
        eyebrow="Profile and trust"
        subtitle="Understand the evidence behind your Karri history and current activity."
        title="Your Karri identity"
      />

      <DashboardHeaderImage
        accessibilityLabel="Explainable trust"
        aspectRatio={1956 / 804}
        source={require("../../assets/profile-trust-badge-icon.png")}
      />

      {auth.loading || loading ? (
        <LoadingState message="Loading profile activity..." />
      ) : null}

      {!auth.loading && !auth.user ? (
        <EmptyState
          action={<PrimaryButton onPress={() => router.push("/login")}>Get started</PrimaryButton>}
          description="View trust history, identity status, and notifications in one place."
          marker="P"
          title="Sign in to see your Karri profile"
        />
      ) : null}

      {error ? (
        <>
          <Banner
            message={
              showingStaleProfileActivity
                ? `${error} Showing last loaded profile activity from this session.`
                : error
            }
            title="Profile activity issue"
            variant={showingStaleProfileActivity ? "warning" : "error"}
          />
          <PrimaryButton
            onPress={() => setActivityRetryKey((current) => current + 1)}
            variant="secondary"
          >
            Retry profile activity
          </PrimaryButton>
        </>
      ) : null}

      {auth.user ? (
        <>
          {identityVerification.loading ? (
            <LoadingState message="Loading identity verification..." />
          ) : identityVerification.error ? (
            <Card padding="compact" variant="outlined">
              <Banner
                compact
                message={identityVerification.error}
                title="Identity verification unavailable"
                variant="error"
              />
              <PrimaryButton
                variant="ghost"
                onPress={() => void identityVerification.refresh()}
              >
                Try again
              </PrimaryButton>
            </Card>
          ) : (
            <>
              <VerificationStatusCard summary={identityVerification.summary} />
              {identityVerification.summary ? (
                <VerificationChecklist summary={identityVerification.summary} />
              ) : null}
              {identityVerification.verification ? (
                <VerificationTimeline events={identityVerification.verification.events} />
              ) : null}
            </>
          )}

          <TrustSummaryCard
            accountCreatedAt={auth.user.createdAt}
            bookings={bookings}
            refreshKey={`${notifications.length}:${identityVerification.verification?.updatedAt ?? "none"}`}
            title="Your trust score"
            userId={auth.user.uid}
            verificationLevel={identityVerification.summary?.level}
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
              message="Profile setup is separate from the read-only identity verification foundation above."
              title="Profile details only"
              variant="development"
            />
            <PrimaryButton variant="secondary" onPress={() => router.push("/profile-setup")}>
              Review profile setup
            </PrimaryButton>
          </Card>

          <Card variant="outlined">
            <SectionHeader
              subtitle="This ends the current anonymous MVP session on this device."
              title="Session"
            />
            {sessionError ? (
              <Banner message={sessionError} title="Sign out failed" variant="error" />
            ) : null}
            <PrimaryButton
              disabled={signingOut}
              loading={signingOut}
              variant="secondary"
              onPress={handleSignOut}
            >
              Sign out
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
    gap: spacing.sm,
  },
  notificationRow: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.md,
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





