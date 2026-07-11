import React, { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View, Pressable, Alert } from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import type { Booking } from "../../domain/booking/Booking";

type TravelerCustodyModalProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly booking: Booking;
  readonly shipmentContentVersion: number;
  readonly senderDeclarationVersion: string;
  readonly onConfirmPickup: (acceptancePayload: any) => Promise<void>;
};

type SafeStopReason =
  | "do_not_accept"
  | "request_clarification"
  | "content_mismatch"
  | "safety_concern"
  | "cancel";

export function TravelerCustodyModal({
  visible,
  onClose,
  booking,
  shipmentContentVersion,
  senderDeclarationVersion,
  onConfirmPickup,
}: TravelerCustodyModalProps) {
  // 9 visual inspection checks
  const [inspection, setInspection] = useState({
    packageAvailableForInspection: false,
    packagingSecure: false,
    weightAppearsReasonable: false,
    noVisibleLeak: false,
    noVisibleBatteryDamage: false,
    noSuspiciousWiring: false,
    noUnusualOdorOrContamination: false,
    noVisibleConcealment: false,
    visibleContentsAppearConsistent: false,
  });

  // 5 legal / custody acknowledgements
  const [acknowledgements, setAcknowledgements] = useState({
    personallyInspected: false,
    contentsAppearConsistent: false,
    noSuspiciousItemsObserved: false,
    safeTransportationAccepted: false,
    reasonableCustodyResponsibilityAccepted: false,
  });

  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Safe-stop state
  const [selectedIssue, setSelectedIssue] = useState<SafeStopReason | null>(null);

  const toggleInspection = (key: keyof typeof inspection) => {
    if (confirming) return;
    setInspection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAcknowledgement = (key: keyof typeof acknowledgements) => {
    if (confirming) return;
    setAcknowledgements((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allInspectionChecked = Object.values(inspection).every(Boolean);
  const allAcknowledgementsChecked = Object.values(acknowledgements).every(Boolean);
  const canSubmit = allInspectionChecked && allAcknowledgementsChecked && !confirming;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setConfirming(true);
    setErrorMsg(null);
    try {
      const payload = {
        bookingId: booking.id,
        shipmentId: booking.shipmentId,
        acceptedByUserId: booking.travelerId,
        custodyVersion: 1,
        custodyPolicyVersion: "2026-07-v1",
        declarationVersion: "v1",
        packageContentVersion: shipmentContentVersion,
        senderDeclarationVersion,
        inspection,
        acknowledgements,
      };
      await onConfirmPickup(payload);
      handleResetAndClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to confirm custody transfer.");
    } finally {
      setConfirming(false);
    }
  };

  const handleResetAndClose = () => {
    setInspection({
      packageAvailableForInspection: false,
      packagingSecure: false,
      weightAppearsReasonable: false,
      noVisibleLeak: false,
      noVisibleBatteryDamage: false,
      noSuspiciousWiring: false,
      noUnusualOdorOrContamination: false,
      noVisibleConcealment: false,
      visibleContentsAppearConsistent: false,
    });
    setAcknowledgements({
      personallyInspected: false,
      contentsAppearConsistent: false,
      noSuspiciousItemsObserved: false,
      safeTransportationAccepted: false,
      reasonableCustodyResponsibilityAccepted: false,
    });
    setSelectedIssue(null);
    setErrorMsg(null);
    onClose();
  };

  const getSafeStopMessage = (reason: SafeStopReason) => {
    switch (reason) {
      case "do_not_accept":
        return "You have chosen not to accept this package. Do not take custody. Please return it to the sender immediately. Contact Karri support if you need further help.";
      case "request_clarification":
        return "Please ask the sender to clarify the package contents or packaging details. Do not take custody until all concerns are fully resolved.";
      case "content_mismatch":
        return "Handoff Halted: Senders must fully disclose all contents. Please return the package to the sender immediately and contact Support to report the mismatch.";
      case "safety_concern":
        return "Handoff Halted: Unsafe package detected. Return the package to the sender immediately. Report the safety concern to Karri Support.";
      default:
        return "Handoff cancelled. No changes have been made.";
    }
  };

  if (selectedIssue) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.safeStopContainer}>
          <Text style={styles.safeStopTitle}>Handoff Halted</Text>
          <Text style={styles.safeStopSubtitle}>
            {selectedIssue === "cancel" ? "Handoff Cancelled" : "Safety Protection Triggered"}
          </Text>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{getSafeStopMessage(selectedIssue)}</Text>
          </View>
          <PrimaryButton variant="secondary" onPress={handleResetAndClose}>
            Back to Booking
          </PrimaryButton>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Traveler Custody Acceptance</Text>
          <Text style={styles.subtitle}>Verify package details and inspect contents before accepting custody.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Section 1: Visual Inspection */}
          <Text style={styles.sectionHeader}>Visual Inspection</Text>
          <Text style={styles.sectionSubtitle}>
            Observe the package. All visual verification checklist items must be successfully checked to proceed.
          </Text>

          <Checkbox
            checked={inspection.packageAvailableForInspection}
            label="Package is available for visual inspection"
            onPress={() => toggleInspection("packageAvailableForInspection")}
          />
          <Checkbox
            checked={inspection.packagingSecure}
            label="Packaging is secure and not tampered with"
            onPress={() => toggleInspection("packagingSecure")}
          />
          <Checkbox
            checked={inspection.weightAppearsReasonable}
            label="Weight matches the declared weight"
            onPress={() => toggleInspection("weightAppearsReasonable")}
          />
          <Checkbox
            checked={inspection.noVisibleLeak}
            label="No signs of liquid leakage or wet spots"
            onPress={() => toggleInspection("noVisibleLeak")}
          />
          <Checkbox
            checked={inspection.noVisibleBatteryDamage}
            label="No signs of battery damage, swelling, or heat"
            onPress={() => toggleInspection("noVisibleBatteryDamage")}
          />
          <Checkbox
            checked={inspection.noSuspiciousWiring}
            label="No exposed wires, suspicious taping, or custom electronics"
            onPress={() => toggleInspection("noSuspiciousWiring")}
          />
          <Checkbox
            checked={inspection.noUnusualOdorOrContamination}
            label="No unusual chemical, fuel, or pungent odors"
            onPress={() => toggleInspection("noUnusualOdorOrContamination")}
          />
          <Checkbox
            checked={inspection.noVisibleConcealment}
            label="No evidence of concealed compartments or hidden cavities"
            onPress={() => toggleInspection("noVisibleConcealment")}
          />
          <Checkbox
            checked={inspection.visibleContentsAppearConsistent}
            label="Contents match the sender's declaration description"
            onPress={() => toggleInspection("visibleContentsAppearConsistent")}
          />

          <View style={styles.divider} />

          {/* Section 2: Custody Agreements */}
          <Text style={styles.sectionHeader}>Chain of Responsibility</Text>
          <Text style={styles.sectionSubtitle}>
            Read and accept these custody and transportation acknowledgements.
          </Text>

          <Checkbox
            checked={acknowledgements.personallyInspected}
            label="I have personally inspected the package contents."
            onPress={() => toggleAcknowledgement("personallyInspected")}
          />
          <Checkbox
            checked={acknowledgements.contentsAppearConsistent}
            label="Contents appear consistent with the sender's declaration."
            onPress={() => toggleAcknowledgement("contentsAppearConsistent")}
          />
          <Checkbox
            checked={acknowledgements.noSuspiciousItemsObserved}
            label="No suspicious or prohibited items were observed."
            onPress={() => toggleAcknowledgement("noSuspiciousItemsObserved")}
          />
          <Checkbox
            checked={acknowledgements.safeTransportationAccepted}
            label="I agree to exercise reasonable care while the package is in my custody and to follow the agreed transportation, delivery, and handoff process."
            onPress={() => toggleAcknowledgement("safeTransportationAccepted")}
          />
          <Checkbox
            checked={acknowledgements.reasonableCustodyResponsibilityAccepted}
            label="I understand that I am responsible for safeguarding the package while it remains in my custody, subject to the sender's obligation to disclose its contents fully and accurately."
            onPress={() => toggleAcknowledgement("reasonableCustodyResponsibilityAccepted")}
          />

          <View style={styles.divider} />

          {/* Issue Section */}
          <Text style={styles.issueHeader}>Having trouble or see an issue?</Text>
          <Text style={styles.issueSubtitle}>
            If you observe any package defect, safety concern, or mismatch, stop immediately.
          </Text>
          <View style={styles.issueButtons}>
            <Pressable
              style={styles.issueButton}
              onPress={() => setSelectedIssue("content_mismatch")}
            >
              <Text style={styles.issueButtonText}>Report Content Mismatch</Text>
            </Pressable>
            <Pressable
              style={styles.issueButton}
              onPress={() => setSelectedIssue("safety_concern")}
            >
              <Text style={styles.issueButtonText}>Report Safety Concern</Text>
            </Pressable>
            <Pressable
              style={styles.issueButton}
              onPress={() => setSelectedIssue("request_clarification")}
            >
              <Text style={styles.issueButtonText}>Request Clarification</Text>
            </Pressable>
            <Pressable
              style={styles.issueButton}
              onPress={() => setSelectedIssue("do_not_accept")}
            >
              <Text style={styles.issueButtonText}>Do Not Accept Package</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton disabled={!canSubmit} loading={confirming} onPress={handleSubmit}>
            Accept Custody & Confirm Pickup
          </PrimaryButton>
          <PrimaryButton variant="secondary" disabled={confirming} onPress={() => setSelectedIssue("cancel")}>
            Cancel
          </PrimaryButton>
        </View>
      </View>
    </Modal>
  );
}

type CheckboxProps = {
  readonly checked: boolean;
  readonly label: string;
  readonly onPress: () => void;
};

function Checkbox({ checked, label, onPress }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.checkboxContainer}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkboxIcon}>✓</Text> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    ...typography.headline,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionHeader: {
    color: colors.text,
    ...typography.title,
    marginTop: spacing.md,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxIcon: {
    color: colors.white,
    fontWeight: "bold",
    fontSize: 14,
  },
  checkboxLabel: {
    flex: 1,
    color: colors.text,
    ...typography.body,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  issueHeader: {
    color: colors.warning,
    ...typography.bodyStrong,
    marginTop: spacing.sm,
  },
  issueSubtitle: {
    color: colors.textSecondary,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  issueButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  issueButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  issueButtonText: {
    color: colors.text,
    ...typography.caption,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  errorBox: {
    padding: spacing.md,
    backgroundColor: colors.errorSoft,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    ...typography.body,
  },
  safeStopContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  safeStopTitle: {
    color: colors.error,
    ...typography.headline,
  },
  safeStopSubtitle: {
    color: colors.text,
    ...typography.title,
  },
  warningBox: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radii.lg,
    width: "100%",
  },
  warningText: {
    color: colors.text,
    ...typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
});
