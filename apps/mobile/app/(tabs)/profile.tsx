import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import { TrustBadge } from "../../src/components/TrustBadge";
import type { Booking } from "../../src/domain/booking/Booking";
import type { Notification } from "../../src/domain/notification/Notification";
import { TrustSummaryCard } from "../../src/presentation/components/TrustSummaryCard";
import { getFriendlyError } from "../../src/presentation/errors/getFriendlyError";
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
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading) {
      return;
    }

    if (!auth.user) {
      setLoading(false);
      setBookings([]);
      setNotifications([]);
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
          setError(getFriendlyError(watchError));
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
          setError(getFriendlyError(watchError));
          setLoading(false);
        },
      );

      return () => {
        unsubscribeBookings();
        unsubscribeNotifications();
      };
    } catch (watchError) {
      setError(getFriendlyError(watchError));
      setLoading(false);
      return;
    }
  }, [auth.loading, auth.user]);

  async function markRead(notificationId: string) {
    setMarkingRead(notificationId);
    setError(null);
    try {
      await mobileServices.notification.markRead(notificationId);
    } catch (markError) {
      setError(getFriendlyError(markError));
    } finally {
      setMarkingRead(null);
    }
  }

  const unreadCount = notifications.filter((notification) => notification.status === "unread").length;

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
        <Card style={styles.loadingCard} variant="outlined">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Loading profile activity...</Text>
        </Card>
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
                {notifications.map((notification) => (
                  <View key={notification.id} style={styles.notificationRow}>
                    <View style={styles.notificationCopy}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      <Text style={styles.muted}>{notification.body}</Text>
                      <Text style={styles.muted}>{formatTimestamp(notification.createdAt)}</Text>
                    </View>
                    {notification.status === "unread" ? (
                      <PrimaryButton
                        loading={markingRead === notification.id}
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
                ))}
              </View>
            )}
          </Card>

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
  loadingCard: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
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
