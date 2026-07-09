import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Banner } from "../../src/components/Banner";
import { DashboardHeaderImage } from "../../src/components/DashboardHeaderImage";
import { EmptyState } from "../../src/components/EmptyState";
import { LoadingState } from "../../src/components/LoadingState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import type { Booking, BookingRequest } from "../../src/domain/booking/Booking";
import type { Notification } from "../../src/domain/notification/Notification";
import { BookingDetailCard } from "../../src/presentation/components/BookingDetailCard";
import { reportFriendlyError } from "../../src/presentation/errors/getFriendlyError";
import { useAuthSession } from "../../src/presentation/hooks/useAuthSession";
import { useIdentityVerification } from "../../src/presentation/hooks/useIdentityVerification";
import { mobileServices } from "../../src/presentation/services/mobileServices";
import { spacing } from "../../src/theme/tokens";

export default function TrackingScreen() {
  const auth = useAuthSession();
  const identity = useIdentityVerification(auth.user?.uid ?? null);
  const [bookings, setBookings] = useState<ReadonlyArray<Booking>>([]);
  const [bookingRequests, setBookingRequests] = useState<ReadonlyArray<BookingRequest>>([]);
  const [notifications, setNotifications] = useState<ReadonlyArray<Notification>>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading) {
      return;
    }

    if (!auth.user) {
      setBookings([]);
      setBookingRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      return mobileServices.booking.watchActivityForParticipant(
        auth.user.uid,
        (activity) => {
          setBookings(activity.bookings);
          setBookingRequests(activity.requests);
          setLoading(false);
        },
        (watchError) => {
          setError(reportFriendlyError(watchError, "tracking.watch-booking-activity"));
          setLoading(false);
        },
      );
    } catch (watchError) {
      setError(reportFriendlyError(watchError, "tracking.start-booking-watch"));
      setLoading(false);
      return;
    }
  }, [auth.loading, auth.user]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      setNotifications([]);
      setNotificationError(null);
      return;
    }

    try {
      return mobileServices.notification.watchForRecipient(
        auth.user.uid,
        setNotifications,
        (watchError) =>
          setNotificationError(
            reportFriendlyError(watchError, "tracking.watch-notifications"),
          ),
      );
    } catch (watchError) {
      setNotificationError(
        reportFriendlyError(watchError, "tracking.start-notification-watch"),
      );
      return;
    }
  }, [auth.loading, auth.user]);

  const requestsById = useMemo(
    () => new Map(bookingRequests.map((request) => [request.id, request])),
    [bookingRequests],
  );

  return (
    <Screen contentStyle={styles.page} withTabBar>
      <SectionHeader
        action={!loading && auth.user ? <StatusChip label={`${bookings.length} bookings`} tone="info" /> : undefined}
        eyebrow="Booking and custody"
        subtitle="Follow each accepted agreement from request through completion."
        title="Tracking with clarity"
      />

      <DashboardHeaderImage
        accessibilityLabel="Visible responsibility"
        aspectRatio={2172 / 724}
        source={require("../../assets/track-trust-badge-icon.png")}
      />

      {auth.loading || loading ? (
        <LoadingState message="Loading your bookings..." />
      ) : null}

      {!auth.loading && !auth.user ? (
        <EmptyState
          action={<PrimaryButton onPress={() => router.push("/login")}>Get started</PrimaryButton>}
          description="Start a Karri session to view booking progress and custody updates."
          marker="C"
          title="Sign in to track shipments"
        />
      ) : null}

      {error ? <Banner message={error} title="Bookings could not load" variant="error" /> : null}
      {identity.error ? (
        <Banner compact message={identity.error} title="Identity status unavailable" variant="warning" />
      ) : null}
      {notificationError ? (
        <Banner
          compact
          message={notificationError}
          title="Activity notifications unavailable"
          variant="warning"
        />
      ) : null}

      {!loading && auth.user && !error && bookings.length === 0 ? (
        <EmptyState
          action={
            <PrimaryButton variant="secondary" onPress={() => router.push("/(tabs)/home")}>
              View matches
            </PrimaryButton>
          }
          description="Request a booking from a matching route, then track progress here."
          marker="B"
          title="No shipments are being tracked yet"
        />
      ) : null}

      {!loading && auth.user && !error ? (
        <View style={styles.list}>
          {bookings.map((booking) => (
            <BookingDetailCard
              key={booking.id}
              booking={booking}
              bookingRequest={requestsById.get(booking.bookingRequestId)}
              currentUserId={auth.user!.uid}
              identityVerification={identity.verification}
              notifications={notifications}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.xl,
  },
  list: {
    gap: spacing.xl,
  },
});







