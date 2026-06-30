import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import { TrustBadge } from "../../src/components/TrustBadge";
import type { Booking, BookingRequest } from "../../src/domain/booking/Booking";
import { BookingDetailCard } from "../../src/presentation/components/BookingDetailCard";
import { reportFriendlyError } from "../../src/presentation/errors/getFriendlyError";
import { useAuthSession } from "../../src/presentation/hooks/useAuthSession";
import { mobileServices } from "../../src/presentation/services/mobileServices";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function TrackingScreen() {
  const auth = useAuthSession();
  const [bookings, setBookings] = useState<ReadonlyArray<Booking>>([]);
  const [bookingRequests, setBookingRequests] = useState<ReadonlyArray<BookingRequest>>([]);
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

      <TrustBadge
        detail="Every lifecycle change is guarded, and custody records are appended rather than rewritten."
        label="Visible responsibility"
      />

      {auth.loading || loading ? (
        <Card style={styles.loadingCard} variant="outlined">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Loading your bookings...</Text>
        </Card>
      ) : null}

      {!auth.loading && !auth.user ? (
        <EmptyState
          action={<PrimaryButton onPress={() => router.push("/login")}>Get started</PrimaryButton>}
          description="Start a Karri session to view bookings and custody history."
          marker="C"
          title="Sign in to track a booking"
        />
      ) : null}

      {error ? <Banner message={error} title="Bookings could not load" variant="error" /> : null}

      {!loading && auth.user && !error && bookings.length === 0 ? (
        <EmptyState
          action={
            <PrimaryButton variant="secondary" onPress={() => router.push("/(tabs)/home")}>
              View route matches
            </PrimaryButton>
          }
          description="Request a booking from an eligible route match. Traveler requests appear here too."
          marker="B"
          title="No bookings yet"
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
  loadingCard: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  muted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
