import { useState, useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Banner } from "../../components/Banner";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { StatusChip } from "../../components/StatusChip";
import { TextField } from "../../components/TextField";
import { BookingStatus, type Booking } from "../../domain/booking/Booking";
import type { BookingHandoffAgreement } from "../../domain/handoff/HandoffAgreement";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { reportFriendlyError } from "../errors/getFriendlyError";
import { mobileServices } from "../services/mobileServices";
import { shortId } from "./operationalPresentation";

interface HandoffCoordinationCardProps {
  readonly booking: Booking;
  readonly currentUserId: string;
  readonly handoffAgreement: BookingHandoffAgreement | null;
  readonly loading?: boolean;
}

export function HandoffCoordinationCard({
  booking,
  currentUserId,
  handoffAgreement,
  loading = false,
}: HandoffCoordinationCardProps) {
  const isSender = booking.senderId === currentUserId;
  const isTraveler = booking.travelerId === currentUserId;

  // Ephemeral verification code states for sender (never persisted at rest)
  const [pickupRevealedCode, setPickupRevealedCode] = useState<string | null>(null);
  const [generatingPickup, setGeneratingPickup] = useState(false);
  const [pickupCodeError, setPickupCodeError] = useState<string | null>(null);

  const [deliveryRevealedCode, setDeliveryRevealedCode] = useState<string | null>(null);
  const [generatingDelivery, setGeneratingDelivery] = useState(false);
  const [deliveryCodeError, setDeliveryCodeError] = useState<string | null>(null);

  // Form states for editing appointment/contacts
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const [pickupMeetingPoint, setPickupMeetingPoint] = useState("");
  const [pickupScheduledAt, setPickupScheduledAt] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");

  const [dropoffMeetingPoint, setDropoffMeetingPoint] = useState("");
  const [dropoffScheduledAt, setDropoffScheduledAt] = useState("");
  const [dropoffNotes, setDropoffNotes] = useState("");

  const [contactPhone, setContactPhone] = useState("");
  const [contactNotes, setContactNotes] = useState("");

  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverLabel, setReceiverLabel] = useState("");
  const [isSenderReceiver, setIsSenderReceiver] = useState(true);

  // Verification entry states for traveler
  const [pickupInputCode, setPickupInputCode] = useState("");
  const [verifyingPickup, setVerifyingPickup] = useState(false);
  const [pickupVerifyError, setPickupVerifyError] = useState<string | null>(null);
  const [pickupVerifySuccess, setPickupVerifySuccess] = useState<string | null>(null);

  const [deliveryInputCode, setDeliveryInputCode] = useState("");
  const [verifyingDelivery, setVerifyingDelivery] = useState(false);
  const [deliveryVerifyError, setDeliveryVerifyError] = useState<string | null>(null);
  const [deliveryVerifySuccess, setDeliveryVerifySuccess] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);

  // Initialize edit fields when handoffAgreement changes
  useEffect(() => {
    if (handoffAgreement) {
      setPickupMeetingPoint(handoffAgreement.pickup.meetingPoint || "");
      setPickupScheduledAt(handoffAgreement.pickup.scheduledAt || "");
      setPickupNotes(handoffAgreement.pickup.notes || "");

      setDropoffMeetingPoint(handoffAgreement.dropoff.meetingPoint || "");
      setDropoffScheduledAt(handoffAgreement.dropoff.scheduledAt || "");
      setDropoffNotes(handoffAgreement.dropoff.notes || "");

      if (isSender) {
        setContactPhone(handoffAgreement.senderContact.phone || "");
        setContactNotes(handoffAgreement.senderContact.notes || "");
      } else {
        setContactPhone(handoffAgreement.travelerContact.phone || "");
        setContactNotes(handoffAgreement.travelerContact.notes || "");
      }

      setReceiverName(handoffAgreement.receiver.name || "");
      setReceiverPhone(handoffAgreement.receiver.phone || "");
      setReceiverLabel(handoffAgreement.receiver.label || "");
      setIsSenderReceiver(handoffAgreement.receiver.isSenderReceiver);
    }
  }, [handoffAgreement, isSender]);

  if (booking.status === BookingStatus.Pending) {
    return (
      <Card padding="compact" variant="outlined">
        <View style={styles.header}>
          <Text style={styles.title}>Handoff details</Text>
          <StatusChip label="Locked" tone="neutral" />
        </View>
        <Text style={styles.mutedText}>
          Private handoff details become available after booking acceptance.
        </Text>
      </Card>
    );
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    setEditError(null);
    setEditSuccess(null);
    try {
      if (isSender) {
        await mobileServices.handoff.updateSenderContact(booking.id, {
          name: handoffAgreement?.senderContact.name || "Sender",
          phone: contactPhone,
          notes: contactNotes,
        });

        await mobileServices.handoff.updateReceiver(booking.id, {
          name: receiverName || "Receiver",
          phone: receiverPhone,
          label: receiverLabel,
          isSenderReceiver,
        });
      } else {
        await mobileServices.handoff.updateTravelerContact(booking.id, {
          name: handoffAgreement?.travelerContact.name || "Traveler",
          phone: contactPhone,
          notes: contactNotes,
        });
      }

      await mobileServices.handoff.proposeAppointments({
        bookingId: booking.id,
        actorId: currentUserId,
        pickup: {
          meetingPoint: pickupMeetingPoint,
          scheduledAt: pickupScheduledAt,
          notes: pickupNotes,
        },
        dropoff: {
          meetingPoint: dropoffMeetingPoint,
          scheduledAt: dropoffScheduledAt,
          notes: dropoffNotes,
        },
      });

      setEditSuccess("Handoff details updated and proposed.");
      setIsEditing(false);
    } catch (error) {
      setEditError(reportFriendlyError(error, "handoff.save-edit"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmAgreement() {
    setConfirming(true);
    setEditError(null);
    try {
      await mobileServices.handoff.confirmAgreement(booking.id, currentUserId);
      setEditSuccess("Handoff agreement confirmed.");
    } catch (error) {
      setEditError(reportFriendlyError(error, "handoff.confirm"));
    } finally {
      setConfirming(false);
    }
  }

  async function handleVerifyPickup() {
    if (!pickupInputCode || pickupInputCode.trim().length !== 6) {
      setPickupVerifyError("Please enter the 6-digit pickup verification code.");
      return;
    }
    setVerifyingPickup(true);
    setPickupVerifyError(null);
    setPickupVerifySuccess(null);
    try {
      const res = await mobileServices.handoff.verifyPickup(booking.id, pickupInputCode.trim());
      if (res.verified) {
        setPickupVerifySuccess("Pickup handoff verified successfully!");
        setPickupInputCode("");
      }
    } catch (error) {
      setPickupVerifyError(reportFriendlyError(error, "handoff.verify-pickup"));
    } finally {
      setVerifyingPickup(false);
    }
  }

  async function handleVerifyDelivery() {
    if (!deliveryInputCode || deliveryInputCode.trim().length !== 6) {
      setDeliveryVerifyError("Please enter the 6-digit delivery verification code.");
      return;
    }
    setVerifyingDelivery(true);
    setDeliveryVerifyError(null);
    setDeliveryVerifySuccess(null);
    try {
      const res = await mobileServices.handoff.verifyDelivery(booking.id, deliveryInputCode.trim());
      if (res.verified) {
        setDeliveryVerifySuccess("Delivery handoff verified successfully!");
        setDeliveryInputCode("");
      }
    } catch (error) {
      setDeliveryVerifyError(reportFriendlyError(error, "handoff.verify-delivery"));
    } finally {
      setVerifyingDelivery(false);
    }
  }

  async function handleGeneratePickupCode() {
    setGeneratingPickup(true);
    setPickupCodeError(null);
    try {
      const res = await mobileServices.handoff.issueVerificationCode(booking.id, "pickup");
      setPickupRevealedCode(res.code);
    } catch (error) {
      setPickupCodeError(reportFriendlyError(error, "handoff.generate-pickup-code"));
    } finally {
      setGeneratingPickup(false);
    }
  }

  async function handleGenerateDeliveryCode() {
    setGeneratingDelivery(true);
    setDeliveryCodeError(null);
    try {
      const res = await mobileServices.handoff.issueVerificationCode(booking.id, "delivery");
      setDeliveryRevealedCode(res.code);
    } catch (error) {
      setDeliveryCodeError(reportFriendlyError(error, "handoff.generate-delivery-code"));
    } finally {
      setGeneratingDelivery(false);
    }
  }

  const confirmationStatus = handoffAgreement?.confirmation.status ?? "needs_confirmation";
  const needsMyConfirmation =
    confirmationStatus === "proposed" &&
    handoffAgreement?.confirmation.proposedBy !== currentUserId;

  const otherContact = isSender
    ? handoffAgreement?.travelerContact
    : handoffAgreement?.senderContact;
  const otherRole = isSender ? "Traveler" : "Sender";

  const pickupVerified = handoffAgreement?.pickupVerification.verified ?? false;
  const deliveryVerified = handoffAgreement?.deliveryVerification.verified ?? false;

  return (
    <Card padding="compact" variant="soft">
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Secure handoff</Text>
          <Text style={styles.title}>Handoff details</Text>
        </View>
        <StatusChip
          label={
            confirmationStatus === "confirmed"
              ? "Agreed"
              : needsMyConfirmation
                ? "Needs your confirmation"
                : confirmationStatus === "proposed"
                  ? "Proposed by you"
                  : "Needs setup"
          }
          tone={
            confirmationStatus === "confirmed"
              ? "success"
              : needsMyConfirmation
                ? "warning"
                : "neutral"
          }
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : null}

      {editError ? <Banner message={editError} title="Update failed" variant="error" /> : null}
      {editSuccess ? <Banner message={editSuccess} title="Saved" variant="success" /> : null}

      {/* Participant Contact Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{otherRole} contact</Text>
        <Text style={styles.bodyText}>
          {otherContact?.name || shortId(isSender ? booking.travelerId : booking.senderId)}
        </Text>
        {otherContact?.phone ? (
          <Text style={styles.mutedText}>Phone: {otherContact.phone}</Text>
        ) : (
          <Text style={styles.mutedText}>No phone number shared yet.</Text>
        )}
        {otherContact?.notes ? (
          <Text style={styles.mutedText}>Note: {otherContact.notes}</Text>
        ) : null}
      </View>

      {/* Destination Receiver Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Authorized destination receiver</Text>
        <Text style={styles.bodyText}>
          {handoffAgreement?.receiver.name || "Recipient not specified"}
          {handoffAgreement?.receiver.label ? ` (${handoffAgreement.receiver.label})` : ""}
        </Text>
        {handoffAgreement?.receiver.phone ? (
          <Text style={styles.mutedText}>Receiver contact: {handoffAgreement.receiver.phone}</Text>
        ) : null}
        {handoffAgreement?.receiver.isSenderReceiver ? (
          <Text style={styles.tagText}>Sender is the destination recipient</Text>
        ) : null}
      </View>

      {/* Pickup Section */}
      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionLabel}>Pickup meetup</Text>
          <StatusChip
            label={pickupVerified ? "Handoff verified" : "Unverified"}
            tone={pickupVerified ? "success" : "warning"}
          />
        </View>
        <Text style={styles.bodyText}>
          Where: {handoffAgreement?.pickup.meetingPoint || "Meeting point to be agreed"}
        </Text>
        <Text style={styles.mutedText}>
          When: {handoffAgreement?.pickup.scheduledAt || "Date and time to be agreed"}
        </Text>
        {handoffAgreement?.pickup.notes ? (
          <Text style={styles.mutedText}>Instructions: {handoffAgreement.pickup.notes}</Text>
        ) : null}

        {/* Sender pickup code view */}
        {isSender && !pickupVerified && (
          <View style={styles.secretBox}>
            <Text style={styles.secretLabel}>Pickup Verification Code</Text>
            {pickupCodeError ? (
              <Banner message={pickupCodeError} title="Code error" variant="error" />
            ) : null}
            {pickupRevealedCode ? (
              <>
                <Text style={styles.secretCode}>{pickupRevealedCode}</Text>
                <Text style={styles.secretHelp}>
                  Share this code only with the traveler involved in this handoff. If you leave this screen and need the code again, generate a new one.
                </Text>
                <PrimaryButton
                  loading={generatingPickup}
                  variant="secondary"
                  onPress={handleGeneratePickupCode}
                >
                  Generate a new code
                </PrimaryButton>
              </>
            ) : (
              <>
                <Text style={styles.secretHelp}>
                  Generate a secure 6-digit code to share with the traveler at physical pickup.
                </Text>
                {handoffAgreement?.pickupVerification.failedAttempts &&
                handoffAgreement.pickupVerification.failedAttempts >= 5 ? (
                  <View style={styles.lockoutBlock}>
                    <Text style={styles.lockoutText}>
                      Code is locked due to repeated incorrect attempts. Generate a replacement code to reset.
                    </Text>
                  </View>
                ) : null}
                <PrimaryButton
                  loading={generatingPickup}
                  variant="secondary"
                  onPress={handleGeneratePickupCode}
                >
                  {handoffAgreement?.pickupVerification.failedAttempts &&
                  handoffAgreement.pickupVerification.failedAttempts >= 5
                    ? "Generate replacement code"
                    : "Generate pickup code"}
                </PrimaryButton>
              </>
            )}
          </View>
        )}

        {/* Traveler pickup code verification entry */}
        {isTraveler && !pickupVerified && booking.status === BookingStatus.Accepted && (
          <View style={styles.verifyBox}>
            <Text style={styles.verifyLabel}>Verify Physical Pickup</Text>
            <Text style={styles.mutedText}>
              Ask the sender for the 6-digit pickup code upon meetup.
            </Text>
            {pickupVerifyError ? (
              <Banner message={pickupVerifyError} title="Verification failed" variant="error" />
            ) : null}
            {pickupVerifySuccess ? (
              <Banner message={pickupVerifySuccess} title="Pickup verified" variant="success" />
            ) : null}
            <TextField
              keyboardType="number-pad"
              label="6-Digit Pickup Code"
              maxLength={6}
              onChangeText={setPickupInputCode}
              placeholder="123456"
              value={pickupInputCode}
            />
            <PrimaryButton
              disabled={pickupInputCode.length !== 6 || verifyingPickup}
              loading={verifyingPickup}
              onPress={handleVerifyPickup}
            >
              Verify pickup code
            </PrimaryButton>
          </View>
        )}
      </View>

      {/* Dropoff Section */}
      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionLabel}>Destination dropoff</Text>
          <StatusChip
            label={deliveryVerified ? "Handoff verified" : "Unverified"}
            tone={deliveryVerified ? "success" : "warning"}
          />
        </View>
        <Text style={styles.bodyText}>
          Where: {handoffAgreement?.dropoff.meetingPoint || "Meeting point to be agreed"}
        </Text>
        <Text style={styles.mutedText}>
          When: {handoffAgreement?.dropoff.scheduledAt || "Expected delivery date/time"}
        </Text>
        {handoffAgreement?.dropoff.notes ? (
          <Text style={styles.mutedText}>Instructions: {handoffAgreement.dropoff.notes}</Text>
        ) : null}

        {/* Sender delivery code view */}
        {isSender && !deliveryVerified && (
          <View style={styles.secretBox}>
            <Text style={styles.secretLabel}>Delivery Verification Code</Text>
            {deliveryCodeError ? (
              <Banner message={deliveryCodeError} title="Code error" variant="error" />
            ) : null}
            {deliveryRevealedCode ? (
              <>
                <Text style={styles.secretCode}>{deliveryRevealedCode}</Text>
                <Text style={styles.secretHelp}>
                  Share this code only with the authorized receiver. If you leave this screen and need the code again, generate a new one.
                </Text>
                <PrimaryButton
                  loading={generatingDelivery}
                  variant="secondary"
                  onPress={handleGenerateDeliveryCode}
                >
                  Generate a new code
                </PrimaryButton>
              </>
            ) : (
              <>
                <Text style={styles.secretHelp}>
                  Generate a secure 6-digit code for the destination receiver to give to the traveler upon delivery.
                </Text>
                {handoffAgreement?.deliveryVerification.failedAttempts &&
                handoffAgreement.deliveryVerification.failedAttempts >= 5 ? (
                  <View style={styles.lockoutBlock}>
                    <Text style={styles.lockoutText}>
                      Code is locked due to repeated incorrect attempts. Generate a replacement code to reset.
                    </Text>
                  </View>
                ) : null}
                <PrimaryButton
                  loading={generatingDelivery}
                  variant="secondary"
                  onPress={handleGenerateDeliveryCode}
                >
                  {handoffAgreement?.deliveryVerification.failedAttempts &&
                  handoffAgreement.deliveryVerification.failedAttempts >= 5
                    ? "Generate replacement code"
                    : "Generate delivery code"}
                </PrimaryButton>
              </>
            )}
          </View>
        )}

        {/* Traveler delivery code verification entry */}
        {isTraveler && !deliveryVerified && booking.status === BookingStatus.InTransit && (
          <View style={styles.verifyBox}>
            <Text style={styles.verifyLabel}>Verify Destination Delivery</Text>
            <Text style={styles.mutedText}>
              Ask the authorized receiver for the 6-digit delivery code upon arrival.
            </Text>
            {deliveryVerifyError ? (
              <Banner message={deliveryVerifyError} title="Verification failed" variant="error" />
            ) : null}
            {deliveryVerifySuccess ? (
              <Banner message={deliveryVerifySuccess} title="Delivery verified" variant="success" />
            ) : null}
            <TextField
              keyboardType="number-pad"
              label="6-Digit Delivery Code"
              maxLength={6}
              onChangeText={setDeliveryInputCode}
              placeholder="654321"
              value={deliveryInputCode}
            />
            <PrimaryButton
              disabled={deliveryInputCode.length !== 6 || verifyingDelivery}
              loading={verifyingDelivery}
              onPress={handleVerifyDelivery}
            >
              Verify delivery code
            </PrimaryButton>
          </View>
        )}
      </View>

      {/* Confirmation & Edit Actions */}
      {needsMyConfirmation ? (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmText}>
            The other participant proposed handoff details. Please review and confirm.
          </Text>
          <PrimaryButton
            loading={confirming}
            onPress={handleConfirmAgreement}
          >
            Confirm handoff agreement
          </PrimaryButton>
        </View>
      ) : null}

      {!isEditing ? (
        <PrimaryButton
          variant="secondary"
          onPress={() => setIsEditing(true)}
        >
          {confirmationStatus === "needs_confirmation"
            ? "Set up handoff details"
            : "Propose changes to handoff"}
        </PrimaryButton>
      ) : (
        <View style={styles.editForm}>
          <Text style={styles.formTitle}>Edit handoff arrangement</Text>

          <TextField
            label="Your contact phone (private)"
            maxLength={32}
            onChangeText={setContactPhone}
            placeholder="+1 555-0100"
            value={contactPhone}
          />
          <TextField
            label="Your contact note (optional)"
            maxLength={300}
            onChangeText={setContactNotes}
            placeholder="e.g. Call or message via WhatsApp"
            value={contactNotes}
          />

          {isSender ? (
            <View style={styles.subSection}>
              <Text style={styles.subSectionTitle}>Intended receiver details</Text>
              <TextField
                label="Receiver full name"
                maxLength={120}
                onChangeText={setReceiverName}
                placeholder="Name of recipient"
                value={receiverName}
              />
              <TextField
                label="Receiver contact phone"
                maxLength={32}
                onChangeText={setReceiverPhone}
                placeholder="+1 555-0199"
                value={receiverPhone}
              />
              <TextField
                label="Relationship or label (optional)"
                maxLength={60}
                onChangeText={setReceiverLabel}
                placeholder="Self, Relative, Colleague..."
                value={receiverLabel}
              />
            </View>
          ) : null}

          <View style={styles.subSection}>
            <Text style={styles.subSectionTitle}>Pickup meeting details</Text>
            <TextField
              label="Pickup meeting point"
              maxLength={160}
              onChangeText={setPickupMeetingPoint}
              placeholder="e.g. Airport departures entrance 3"
              value={pickupMeetingPoint}
            />
            <TextField
              label="Pickup date/time"
              maxLength={80}
              onChangeText={setPickupScheduledAt}
              placeholder="e.g. 2026-03-01 14:00"
              value={pickupScheduledAt}
            />
            <TextField
              label="Pickup instructions (optional)"
              maxLength={300}
              multiline
              onChangeText={setPickupNotes}
              placeholder="Meeting landmarks, what you are wearing..."
              value={pickupNotes}
            />
          </View>

          <View style={styles.subSection}>
            <Text style={styles.subSectionTitle}>Dropoff meeting details</Text>
            <TextField
              label="Dropoff meeting point"
              maxLength={160}
              onChangeText={setDropoffMeetingPoint}
              placeholder="e.g. Airport arrivals baggage claim"
              value={dropoffMeetingPoint}
            />
            <TextField
              label="Expected dropoff date/time"
              maxLength={80}
              onChangeText={setDropoffScheduledAt}
              placeholder="e.g. 2026-03-02 10:00"
              value={dropoffScheduledAt}
            />
            <TextField
              label="Dropoff instructions (optional)"
              maxLength={300}
              multiline
              onChangeText={setDropoffNotes}
              placeholder="Arrival area details..."
              value={dropoffNotes}
            />
          </View>

          <View style={styles.editActions}>
            <PrimaryButton
              loading={savingEdit}
              onPress={handleSaveEdit}
            >
              Save & propose changes
            </PrimaryButton>
            <PrimaryButton
              disabled={savingEdit}
              variant="secondary"
              onPress={() => setIsEditing(false)}
            >
              Cancel
            </PrimaryButton>
          </View>
        </View>
      )}
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
    minWidth: 160,
  },
  eyebrow: {
    color: colors.primary,
    ...typography.overline,
  },
  title: {
    color: colors.text,
    ...typography.subheading,
  },
  section: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xxs,
    paddingTop: spacing.sm,
  },
  sectionLabel: {
    color: colors.text,
    ...typography.label,
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bodyText: {
    color: colors.text,
    ...typography.body,
  },
  mutedText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  tagText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "600",
  },
  secretBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xxs,
    marginTop: spacing.xs,
    padding: spacing.sm,
  },
  secretLabel: {
    color: colors.text,
    ...typography.label,
  },
  secretCode: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 4,
    paddingVertical: spacing.xs,
  },
  secretHelp: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  lockoutBlock: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  lockoutText: {
    color: colors.error,
    ...typography.caption,
  },
  verifyBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.xs,
    padding: spacing.sm,
  },
  verifyLabel: {
    color: colors.text,
    ...typography.label,
  },
  confirmBox: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  confirmText: {
    color: colors.text,
    ...typography.body,
  },
  editForm: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  formTitle: {
    color: colors.text,
    ...typography.label,
  },
  subSection: {
    gap: spacing.xs,
  },
  subSectionTitle: {
    color: colors.text,
    ...typography.caption,
    fontWeight: "700",
  },
  editActions: {
    gap: spacing.sm,
  },
});
