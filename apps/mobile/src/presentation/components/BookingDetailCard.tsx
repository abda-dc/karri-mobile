import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Banner } from "../../components/Banner";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { StatusChip } from "../../components/StatusChip";
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
import type { Review } from "../../domain/review/Review";
import type { Shipment } from "../../domain/shipment/Shipment";
import type { Trip } from "../../domain/trip/Trip";
import { colors, spacing, typography } from "../../theme/tokens";
import { reportFriendlyError } from "../errors/getFriendlyError";
import { mobileServices } from "../services/mobileServices";
import { TrustSummaryCard } from "./TrustSummaryCard";

interface BookingDetailCardProps {
  readonly booking: Booking;
  readonly bookingRequest?: BookingRequest;
  readonly currentUserId: string;
}

const custodyLabels: Record<CustodyEventType, string> = {
  [CustodyEventType.ShipmentCreated]: "Shipment linked",
  [CustodyEventType.TravelerAccepted]: "Traveler accepted",
  [CustodyEventType.PickupConfirmed]: "Pickup confirmed",
  [CustodyEventType.AirportDeparture]: "Airport departure",
  [CustodyEventType.AirportArrival]: "Airport arrival",
  [CustodyEventType.DeliveryConfirmed]: "Delivery confirmed",
  [CustodyEventType.Completed]: "Journey completed",
};

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function nextAction(booking: Booking): string {
  switch (booking.status) {
    case BookingStatus.Pending:
      return "Traveler accepts or declines the request.";
    case BookingStatus.Accepted:
      return "Traveler confirms package pickup.";
    case BookingStatus.InTransit:
      return "Traveler records travel progress and delivery.";
    case BookingStatus.Delivered:
      return "Sender confirms completion.";
    case BookingStatus.Completed:
      return "Both participants may leave one review.";
    default:
      return "No further lifecycle action is available.";
  }
}

export function BookingDetailCard({
  booking,
  bookingRequest,
  currentUserId,
}: BookingDetailCardProps) {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [custody, setCustody] = useState<ReadonlyArray<CustodyEvent>>([]);
  const [reviews, setReviews] = useState<ReadonlyArray<Review>>([]);
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
        const message = reportFriendlyError(error, "booking-detail.load-related-records");
        if (active) {
          setActionError(message);
          setLoadingDetails(false);
        }
      });

    let unsubscribe: () => void = () => undefined;
    try {
      unsubscribe = mobileServices.custody.watchByBooking(
        booking.id,
        setCustody,
        (error) =>
          setActionError(reportFriendlyError(error, "booking-detail.watch-custody")),
      );
    } catch (error) {
      setActionError(reportFriendlyError(error, "booking-detail.start-custody-watch"));
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [booking.id, booking.shipmentId, booking.tripId]);

  const isSender = booking.senderId === currentUserId;
  const isTraveler = booking.travelerId === currentUserId;
  const otherParticipantId = isSender ? booking.travelerId : booking.senderId;
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
    if (actionLoading) {
      return false;
    }

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
    if (actionLoading) {
      return;
    }

    const numericRating = Number(rating);
    const revieweeId = isSender ? booking.travelerId : booking.senderId;

    setReviewPending(true);
    setActionLoading("review");
    setActionError(null);
    setActionMessage(null);

    try {
      const review = await mobileServices.review.submit({
        bookingId: booking.id,
        reviewerId: currentUserId,
        revieweeId,
        direction: isSender ? "sender_reviews_traveler" : "traveler_reviews_sender",
        rating: numericRating,
        comment,
      });
      setReviews((current) =>
        current.some((existing) => existing.id === review.id)
          ? current
          : [...current, review],
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

  return (
    <Card variant="elevated">
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {shipment?.originCity ?? "Shipment"} → {shipment?.destinationCity ?? "destination"}
          </Text>
          <Text style={styles.muted}>Booking {shortId(booking.id)}</Text>
        </View>
        <View style={styles.statusBlock}>
          <StatusChip
            label={booking.status.replace("_", " ")}
            tone={booking.status === BookingStatus.Completed ? "success" : "active"}
          />
          {pendingTransition ? (
            <StatusChip label={`${pendingTransition.replace("_", " ")} pending`} tone="warning" />
          ) : null}
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryBlock}>
          <Text style={styles.label}>Participants</Text>
          <Text style={styles.muted}>Sender: {shortId(booking.senderId)}</Text>
          <Text style={styles.muted}>Traveler: {shortId(booking.travelerId)}</Text>
        </View>
        <View style={styles.summaryBlock}>
          <Text style={styles.label}>Trip</Text>
          <Text style={styles.muted}>
            {trip ? `${trip.departureDate} → ${trip.arrivalDate}` : shortId(booking.tripId)}
          </Text>
          <Text style={styles.muted}>
            {shipment ? `${shipment.packageCategory} · ${shipment.weightKg} kg` : "Loading shipment"}
          </Text>
        </View>
      </View>

      {bookingRequest ? (
        <View style={styles.summaryBlock}>
          <Text style={styles.label}>Booking request</Text>
          <Text style={styles.muted}>Status: {bookingRequest.status.replace("_", " ")}</Text>
          {bookingRequest.message ? (
            <Text style={styles.muted}>Message: {bookingRequest.message}</Text>
          ) : null}
        </View>
      ) : null}

      <Banner compact message={nextAction(booking)} title="Next expected action" variant="info" />

      <TrustSummaryCard
        compact
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
          message="The requested status is shown as pending until the service write succeeds. Stored status and custody history remain subscription-driven."
          title="Booking update pending"
          variant="warning"
        />
      ) : null}

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
          onPress={() => transition(BookingStatus.InTransit, "Pickup confirmed.")}
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
          onPress={() => transition(BookingStatus.Completed, "Journey completed.")}
        >
          Complete booking
        </PrimaryButton>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status history</Text>
        {booking.statusHistory.map((entry, index) => (
          <View key={`${entry.status}:${entry.changedAt}:${index}`} style={styles.timelineRow}>
            <StatusChip label={entry.status.replace("_", " ")} tone="neutral" />
            <View style={styles.timelineCopy}>
              <Text style={styles.muted}>{new Date(entry.changedAt).toLocaleString()}</Text>
              <Text style={styles.muted}>By {shortId(entry.changedBy)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chain of custody</Text>
        {custody.length === 0 ? (
          <Text style={styles.muted}>No custody events recorded yet.</Text>
        ) : (
          custody.map((event) => (
            <View key={event.id} style={styles.timelineRow}>
              <StatusChip label={custodyLabels[event.eventType]} tone="info" />
              <View style={styles.timelineCopy}>
                <Text style={styles.muted}>
                  {event.timestamp ? new Date(event.timestamp).toLocaleString() : "Pending timestamp"}
                </Text>
                <Text style={styles.muted}>Actor: {shortId(event.performedBy)}</Text>
                {event.location ? <Text style={styles.muted}>Location: {event.location}</Text> : null}
                {event.note ? <Text style={styles.muted}>{event.note}</Text> : null}
              </View>
            </View>
          ))
        )}
      </View>

      {reviewPending ? (
        <Banner
          compact
          message="The review form is locked while Karri validates this one-per-participant write. A failure restores the form and keeps your input."
          title="Review pending"
          variant="warning"
        />
      ) : null}

      {booking.status === BookingStatus.Completed && !alreadyReviewed && !reviewPending ? (
        <View style={styles.form}>
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
        </View>
      ) : null}

      {booking.status === BookingStatus.Completed && alreadyReviewed ? (
        <Banner compact message="Your review is recorded for this booking." title="Review complete" variant="success" />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 210,
  },
  statusBlock: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  label: {
    color: colors.text,
    ...typography.label,
  },
  muted: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  summaryBlock: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 180,
  },
  actions: {
    gap: spacing.sm,
  },
  form: {
    gap: spacing.md,
  },
  section: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.label,
  },
  timelineRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  timelineCopy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 180,
  },
});
