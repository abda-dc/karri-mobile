import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Banner } from "../../components/Banner";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { TextField } from "../../components/TextField";
import {
  BookingStatus,
  type Booking,
  type BookingRequest,
} from "../../domain/booking/Booking";
import {
  CustodyEventType,
  type CustodyEvent,
} from "../../domain/custody/CustodyEvent";
import {
  VerificationStatus,
  type IdentityVerification,
} from "../../domain/identity/IdentityVerification";
import type { Notification } from "../../domain/notification/Notification";
import type { Review } from "../../domain/review/Review";
import type { Shipment } from "../../domain/shipment/Shipment";
import {
  isShipmentLifecycleEvent,
  type ShipmentLifecycleEvent,
} from "../../domain/shipment/ShipmentLifecycleEvent";
import type { Trip } from "../../domain/trip/Trip";
import type { TrustSummary } from "../../domain/trust/TrustScore";
import { colors, spacing, typography } from "../../theme/tokens";
import { reportFriendlyError } from "../errors/getFriendlyError";
import { mobileServices } from "../services/mobileServices";
import { ActivityFeed } from "./ActivityFeed";
import { BookingStatusCard } from "./BookingStatusCard";
import { CustodySummaryCard } from "./CustodySummaryCard";
import { NextActionCard } from "./NextActionCard";
import { ShipmentStatusCard } from "./ShipmentStatusCard";
import { ShipmentTimelineCard } from "./ShipmentTimelineCard";
import { TrustSummaryCard } from "./TrustSummaryCard";

interface BookingDetailCardProps {
  readonly booking: Booking;
  readonly bookingRequest?: BookingRequest;
  readonly currentUserId: string;
  readonly identityVerification: IdentityVerification | null;
  readonly notifications: ReadonlyArray<Notification>;
}

export function BookingDetailCard({
  booking,
  bookingRequest,
  currentUserId,
  identityVerification,
  notifications,
}: BookingDetailCardProps) {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [shipmentTimeline, setShipmentTimeline] = useState<
    ReadonlyArray<ShipmentLifecycleEvent>
  >([]);
  const [custody, setCustody] = useState<ReadonlyArray<CustodyEvent>>([]);
  const [reviews, setReviews] = useState<ReadonlyArray<Review>>([]);
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingTransition, setPendingTransition] = useState<Booking["status"] | null>(null);
  const [reviewPending, setReviewPending] = useState(false);
  const [location, setLocation] = useState("");
  const [custodyNote, setCustodyNote] = useState("");
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");

  const isSender = booking.senderId === currentUserId;
  const isTraveler = booking.travelerId === currentUserId;
  const otherParticipantId = isSender ? booking.travelerId : booking.senderId;

  useEffect(() => {
    let active = true;
    setLoadingDetails(true);

    void Promise.all([
      mobileServices.shipment.findById(booking.shipmentId),
      mobileServices.trip.findById(booking.tripId),
      mobileServices.review.listForBooking(booking.id),
    ])
      .then(([nextShipment, nextTrip, nextReviews]) => {
        if (active) {
          setShipment(nextShipment);
          setTrip(nextTrip);
          setReviews(nextReviews);
          setLoadingDetails(false);
        }
      })
      .catch((error) => {
        if (active) {
          setActionError(reportFriendlyError(error, "booking-detail.load-related-records"));
          setLoadingDetails(false);
        }
      });

    const unsubscribers: Array<() => void> = [];
    const onTimelineError = (error: Error) =>
      setActionError(reportFriendlyError(error, "booking-detail.watch-shipment-timeline"));

    try {
      unsubscribers.push(
        mobileServices.custody.watchByBooking(
          booking.id,
          (events) => {
            setCustody(events);
            if (!isSender) {
              setShipmentTimeline(events.filter(isShipmentLifecycleEvent));
            }
          },
          onTimelineError,
        ),
      );
      if (isSender) {
        unsubscribers.push(
          mobileServices.shipmentTimeline.watchByShipment(
            booking.shipmentId,
            (events) =>
              setShipmentTimeline(events.filter((event) => event.bookingId === booking.id)),
            onTimelineError,
          ),
        );
      }
    } catch (error) {
      setActionError(reportFriendlyError(error, "booking-detail.start-shipment-timeline"));
    }

    return () => {
      active = false;
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [booking.id, booking.shipmentId, booking.tripId, isSender]);

  const alreadyReviewed = reviews.some((review) => review.reviewerId === currentUserId);
  const recordedTypes = useMemo(
    () => new Set(custody.map((event) => event.eventType)),
    [custody],
  );

  async function runAction(
    key: string,
    action: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> {
    if (actionLoading) return false;

    setActionLoading(key);
    setActionError(null);
    setActionMessage(null);
    try {
      await action();
      setActionMessage(success);
      return true;
    } catch (error) {
      setActionError(reportFriendlyError(error, `booking-detail.${key}`));
      return false;
    } finally {
      setActionLoading(null);
    }
  }

  async function transition(nextStatus: Booking["status"], success: string) {
    setPendingTransition(nextStatus);
    const succeeded = await runAction(
      nextStatus,
      () =>
        mobileServices.booking.transition({
          bookingId: booking.id,
          actorId: currentUserId,
          nextStatus,
          location,
          note: custodyNote,
        }),
      success,
    );
    setPendingTransition(null);
    return succeeded;
  }

  function recordTravelEvent(eventType: CustodyEventType, success: string) {
    return runAction(
      eventType,
      () =>
        mobileServices.custody.recordTravelEvent({
          bookingId: booking.id,
          actorId: currentUserId,
          eventType,
          location,
          note: custodyNote,
        }),
      success,
    );
  }

  async function submitReview() {
    if (actionLoading) return;

    setReviewPending(true);
    setActionLoading("review");
    setActionError(null);
    setActionMessage(null);
    try {
      const review = await mobileServices.review.submit({
        bookingId: booking.id,
        reviewerId: currentUserId,
        revieweeId: isSender ? booking.travelerId : booking.senderId,
        direction: isSender ? "sender_reviews_traveler" : "traveler_reviews_sender",
        rating: Number(rating),
        comment,
      });
      setReviews((current) =>
        current.some((existing) => existing.id === review.id) ? current : [...current, review],
      );
      setActionMessage("Review submitted. The other participant has been notified.");
      setRating("");
      setComment("");
    } catch (error) {
      setActionError(reportFriendlyError(error, "booking-detail.submit-review"));
    } finally {
      setReviewPending(false);
      setActionLoading(null);
    }
  }

  const actionInProgress = actionLoading !== null;
  const identityStatus = identityVerification?.status ?? VerificationStatus.Unverified;
  const actionableStatuses: ReadonlyArray<Booking["status"]> = [
    BookingStatus.Pending,
    BookingStatus.Accepted,
    BookingStatus.InTransit,
    BookingStatus.Delivered,
  ];
  const hasLifecycleAction =
    (booking.status === BookingStatus.Pending && (isSender || isTraveler)) ||
    (booking.status === BookingStatus.Accepted && isTraveler) ||
    (booking.status === BookingStatus.InTransit && isTraveler) ||
    (booking.status === BookingStatus.Delivered && isSender);

  return (
    <View style={styles.container}>
      <BookingStatusCard
        booking={booking}
        bookingRequest={bookingRequest}
        currentUserId={currentUserId}
        identityStatus={identityStatus}
        pendingStatus={pendingTransition}
      />
      <ShipmentStatusCard bookingStatus={booking.status} shipment={shipment} trip={trip} />
      <NextActionCard booking={booking} currentUserId={currentUserId} />

      <TrustSummaryCard
        compact
        onSummaryLoaded={setTrustSummary}
        refreshKey={reviews.length}
        title="Other participant trust"
        userId={otherParticipantId}
      />

      {loadingDetails ? <ActivityIndicator color={colors.primary} /> : null}
      {actionError ? <Banner message={actionError} title="Action failed" variant="error" /> : null}
      {actionMessage ? (
        <Banner message={actionMessage} title="Booking updated" variant="success" />
      ) : null}
      {pendingTransition ? (
        <Banner
          compact
          message="The update is pending until the service write succeeds. Stored history remains subscription-driven."
          title="Booking update pending"
          variant="warning"
        />
      ) : null}

      <Card variant="outlined">
        <Text style={styles.sectionTitle}>Available actions</Text>

        {booking.status === BookingStatus.Pending && isTraveler ? (
          <View style={styles.actions}>
            <PrimaryButton
              disabled={actionInProgress}
              loading={actionLoading === BookingStatus.Accepted}
              onPress={() => transition(BookingStatus.Accepted, "Booking accepted.")}
            >
              Accept request
            </PrimaryButton>
            <PrimaryButton
              disabled={actionInProgress}
              loading={actionLoading === BookingStatus.Declined}
              variant="secondary"
              onPress={() => transition(BookingStatus.Declined, "Booking declined.")}
            >
              Decline request
            </PrimaryButton>
          </View>
        ) : null}

        {booking.status === BookingStatus.Pending && isSender ? (
          <PrimaryButton
            disabled={actionInProgress}
            loading={actionLoading === BookingStatus.Cancelled}
            variant="secondary"
            onPress={() => transition(BookingStatus.Cancelled, "Booking cancelled.")}
          >
            Cancel request
          </PrimaryButton>
        ) : null}

        {booking.status === BookingStatus.Accepted && isTraveler ? (
          <PrimaryButton
            disabled={actionInProgress}
            loading={actionLoading === BookingStatus.InTransit}
            onPress={() => transition(BookingStatus.InTransit, "Shipment pickup confirmed.")}
          >
            Confirm pickup
          </PrimaryButton>
        ) : null}

        {booking.status === BookingStatus.InTransit && isTraveler ? (
          <View style={styles.form}>
            <TextField
              label="Location (optional)"
              maxLength={160}
              onChangeText={setLocation}
              placeholder="Airport or city"
              value={location}
            />
            <TextField
              label="Custody note (optional)"
              maxLength={500}
              multiline
              onChangeText={setCustodyNote}
              placeholder="Short handoff or travel context"
              value={custodyNote}
            />
            <View style={styles.actions}>
              {!recordedTypes.has(CustodyEventType.AirportDeparture) ? (
                <PrimaryButton
                  disabled={actionInProgress}
                  loading={actionLoading === CustodyEventType.AirportDeparture}
                  variant="secondary"
                  onPress={() =>
                    recordTravelEvent(CustodyEventType.AirportDeparture, "Departure recorded.")
                  }
                >
                  Record departure
                </PrimaryButton>
              ) : null}
              {recordedTypes.has(CustodyEventType.AirportDeparture) &&
              !recordedTypes.has(CustodyEventType.AirportArrival) ? (
                <PrimaryButton
                  disabled={actionInProgress}
                  loading={actionLoading === CustodyEventType.AirportArrival}
                  variant="secondary"
                  onPress={() =>
                    recordTravelEvent(CustodyEventType.AirportArrival, "Arrival recorded.")
                  }
                >
                  Record arrival
                </PrimaryButton>
              ) : null}
              <PrimaryButton
                disabled={actionInProgress}
                loading={actionLoading === BookingStatus.Delivered}
                onPress={() => transition(BookingStatus.Delivered, "Delivery confirmed.")}
              >
                Confirm delivery
              </PrimaryButton>
            </View>
          </View>
        ) : null}

        {booking.status === BookingStatus.Delivered && isSender ? (
          <PrimaryButton
            disabled={actionInProgress}
            loading={actionLoading === BookingStatus.Completed}
            onPress={() => transition(BookingStatus.Completed, "Shipment completed.")}
          >
            Complete booking
          </PrimaryButton>
        ) : null}

        {!hasLifecycleAction ? (
          <Text style={styles.muted}>
            {actionableStatuses.includes(booking.status)
              ? "The other participant has the next lifecycle action."
              : "No lifecycle action is available for this booking."}
          </Text>
        ) : null}
      </Card>

      <CustodySummaryCard events={custody} />
      <ShipmentTimelineCard
        booking={booking}
        currentUserId={currentUserId}
        events={shipmentTimeline}
      />
      <ActivityFeed
        booking={booking}
        custodyEvents={custody}
        currentUserId={currentUserId}
        identityVerification={identityVerification}
        notifications={notifications}
        trustSummary={trustSummary}
      />

      {reviewPending ? (
        <Banner
          compact
          message="The review form is locked while Karri validates this one-per-participant write."
          title="Review pending"
          variant="warning"
        />
      ) : null}

      {booking.status === BookingStatus.Completed && !alreadyReviewed && !reviewPending ? (
        <Card variant="outlined">
          <Text style={styles.sectionTitle}>Review the other participant</Text>
          <TextField
            keyboardType="number-pad"
            label="Rating (1-5)"
            maxLength={1}
            onChangeText={setRating}
            required
            value={rating}
          />
          <TextField
            label="Comment (optional)"
            maxLength={1000}
            multiline
            onChangeText={setComment}
            value={comment}
          />
          <PrimaryButton
            disabled={actionInProgress}
            loading={actionLoading === "review"}
            onPress={submitReview}
          >
            Submit review
          </PrimaryButton>
        </Card>
      ) : null}

      {booking.status === BookingStatus.Completed && alreadyReviewed ? (
        <Banner
          compact
          message="Your review is recorded for this booking."
          title="Review complete"
          variant="success"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  form: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.label,
  },
  muted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
