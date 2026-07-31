import { router } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Badge } from "../../src/components/Badge";
import { Banner } from "../../src/components/Banner";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { LoadingState } from "../../src/components/LoadingState";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatusChip } from "../../src/components/StatusChip";
import type {
  AdminAdministrativeHold,
  AdminOperationsOverview,
  AdminOperationsSection,
  AdminRecentBooking,
  AdminShipmentSafetyReview,
} from "../../src/domain/admin/AdminOperationsOverview";
import type { AuthorizationRole } from "../../src/domain/authorization/roles";
import { useAdminOperationsOverview } from "../../src/presentation/hooks/useAdminOperationsOverview";
import { getAdministratorIdentityLabel } from "../../src/presentation/hooks/useAdminOperationsOverview";
import { useAuthSession } from "../../src/presentation/hooks/useAuthSession";
import { colors, spacing, typography } from "../../src/theme/tokens";

const roleLabels: Readonly<Record<AuthorizationRole, string>> = {
  user: "User",
  support: "Support",
  moderator: "Moderator",
  operations_admin: "Operations administrator",
  safety_admin: "Safety administrator",
  super_admin: "Super administrator",
};

const decisionLabels: Readonly<Record<AdminShipmentSafetyReview["decision"], string>> = {
  approved: "Approved",
  rejected: "Rejected",
  needs_more_information: "More information needed",
};

const reasonLabels: Readonly<Record<string, string>> = {
  restricted_item: "Restricted item",
  prohibited_item: "Prohibited item",
  insufficient_information: "Insufficient information",
  hazardous_material: "Hazardous material",
  declaration_mismatch: "Declaration mismatch",
  documentation_missing: "Documentation missing",
  verified_safe: "Verified safe",
  safety_review_pending: "Safety review pending",
  suspected_policy_violation: "Suspected policy violation",
  identity_review_required: "Identity review required",
  prohibited_contents: "Prohibited contents",
  manual_investigation: "Manual investigation",
};

const bookingStatusLabels: Readonly<Record<AdminRecentBooking["status"], string>> = {
  pending: "Pending",
  accepted: "Accepted",
  in_transit: "In transit",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
  expired: "Expired",
};

export function shortReference(identifier: string): string {
  const visibleLength = identifier.length > 6 ? 6 : Math.max(1, identifier.length - 1);
  return `…${identifier.slice(-visibleLength)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Date unavailable";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getOverviewSections(overview: AdminOperationsOverview) {
  return [
    overview.activeShipments,
    overview.activeTrips,
    overview.pendingBookingRequests,
    overview.activeBookings,
    overview.recentShipmentSafetyReviews,
    overview.activeAdministrativeHolds,
    overview.recentBookings,
  ] as const;
}

function SummaryCard({
  label,
  section,
  wide,
}: {
  readonly label: string;
  readonly section: AdminOperationsSection<number>;
  readonly wide: boolean;
}) {
  const valueLabel = getSummaryValueLabel(section);

  return (
    <Card
      padding="compact"
      style={[styles.summaryCard, wide ? styles.summaryCardWide : styles.summaryCardNarrow]}
      variant={section.status === "available" ? "elevated" : "soft"}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        accessibilityLabel={`${label}: ${valueLabel}`}
        style={[
          styles.summaryValue,
          section.status !== "available" && styles.summaryValueMuted,
        ]}
      >
        {valueLabel}
      </Text>
      {section.status === "unauthorized" ? (
        <Text style={styles.summaryDetail}>Not available to this role</Text>
      ) : null}
      {section.status === "unavailable" ? (
        <Text style={styles.summaryDetail}>Could not be retrieved</Text>
      ) : null}
    </Card>
  );
}

export function getSummaryValueLabel(
  section: AdminOperationsSection<number>,
): string {
  return section.status === "available"
    ? section.value.toLocaleString()
    : section.status === "unauthorized"
      ? "Restricted"
      : "Unavailable";
}

function SectionUnavailable({
  section,
}: {
  readonly section: Exclude<AdminOperationsSection<unknown>, { status: "available" }>;
}) {
  return (
    <Banner
      message={
        section.status === "unauthorized"
          ? "This information is not available to your current administrator role."
          : "This information could not be retrieved. Other available sections remain current."
      }
      title={section.status === "unauthorized" ? "Restricted section" : "Section unavailable"}
      variant={section.status === "unauthorized" ? "info" : "warning"}
    />
  );
}

function SafetyReviewList({
  section,
}: {
  readonly section: AdminOperationsOverview["recentShipmentSafetyReviews"];
}) {
  if (section.status !== "available") {
    return <SectionUnavailable section={section} />;
  }
  if (section.value.length === 0) {
    return (
      <EmptyState
        description="No shipment safety reviews are currently available."
        marker="SR"
        title="No recent safety reviews"
      />
    );
  }

  return (
    <View style={styles.list}>
      {section.value.map((review) => (
        <Card key={review.id} padding="compact">
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle}>Shipment {shortReference(review.shipmentId)}</Text>
            <StatusChip
              label={decisionLabels[review.decision]}
              tone={review.decision === "approved" ? "success" : review.decision === "rejected" ? "warning" : "info"}
            />
          </View>
          <Text style={styles.rowDetail}>{reasonLabels[review.reasonCode] ?? "Other review reason"}</Text>
          <Text style={styles.rowMeta}>Review {shortReference(review.id)} · {formatDate(review.createdAt)}</Text>
        </Card>
      ))}
    </View>
  );
}

function AdministrativeHoldList({
  section,
}: {
  readonly section: AdminOperationsOverview["activeAdministrativeHolds"];
}) {
  if (section.status !== "available") {
    return <SectionUnavailable section={section} />;
  }
  if (section.value.length === 0) {
    return (
      <EmptyState
        description="There are no active administrative holds in the available results."
        marker="AH"
        title="No active holds"
      />
    );
  }

  return (
    <View style={styles.list}>
      {section.value.map((hold: AdminAdministrativeHold) => (
        <Card key={hold.id} padding="compact">
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle}>Shipment {shortReference(hold.shipmentId)}</Text>
            <StatusChip label="Active hold" tone="warning" />
          </View>
          <Text style={styles.rowDetail}>{reasonLabels[hold.reasonCode] ?? "Other hold reason"}</Text>
          <Text style={styles.rowMeta}>Hold {shortReference(hold.id)} · {formatDate(hold.placedAt)}</Text>
        </Card>
      ))}
    </View>
  );
}

function RecentBookingList({
  section,
}: {
  readonly section: AdminOperationsOverview["recentBookings"];
}) {
  if (section.status !== "available") {
    return <SectionUnavailable section={section} />;
  }
  if (section.value.length === 0) {
    return (
      <EmptyState
        description="No recent bookings are currently available."
        marker="BK"
        title="No recent bookings"
      />
    );
  }

  return (
    <View style={styles.list}>
      {section.value.map((booking: AdminRecentBooking) => (
        <Card key={booking.id} padding="compact">
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle}>Booking {shortReference(booking.id)}</Text>
            <StatusChip
              label={bookingStatusLabels[booking.status]}
              tone={booking.status === "completed" ? "success" : booking.status === "cancelled" || booking.status === "declined" || booking.status === "expired" ? "neutral" : booking.status === "pending" ? "warning" : "active"}
            />
          </View>
          <Text style={styles.rowDetail}>
            Shipment {shortReference(booking.shipmentId)} · Trip {shortReference(booking.tripId)}
          </Text>
          <Text style={styles.rowMeta}>{formatDate(booking.createdAt)}</Text>
        </Card>
      ))}
    </View>
  );
}

export default function AdminOperationsOverviewScreen() {
  const { width } = useWindowDimensions();
  const { user, authorizationRole } = useAuthSession();
  const navigateAfterSignOut = useCallback(() => {
    router.replace("/admin-login");
  }, []);
  const controller = useAdminOperationsOverview({
    authorizationRole,
    identityKey: user?.uid ?? null,
    onSignedOut: navigateAfterSignOut,
  });
  const overview = controller.overview;
  const desktopGrid = width >= 720;
  const sections = overview ? getOverviewSections(overview) : [];
  const availableCount = sections.filter((section) => section.status === "available").length;
  const unavailableCount = sections.filter((section) => section.status === "unavailable").length;
  const completeSectionFailure =
    Boolean(overview) && availableCount === 0 && unavailableCount > 0;
  const partialFailure = availableCount > 0 && unavailableCount > 0;

  return (
    <Screen contentMaxWidth={1120} contentStyle={styles.screenContent}>
      <View style={styles.page}>
        <SectionHeader
          eyebrow="Administration"
          subtitle="Read-only operational health, safety review, hold, and booking activity."
          title="Operations Overview"
        />

        <Card style={styles.identityCard} variant="elevated">
          <View style={styles.identityCopy}>
            <Text style={styles.identityLabel}>Signed in as</Text>
            <Text style={styles.identityValue}>{getAdministratorIdentityLabel(user)}</Text>
            <Badge label={roleLabels[authorizationRole]} tone="primary" />
          </View>
          <PrimaryButton
            disabled={controller.signingOut}
            loading={controller.signingOut}
            onPress={controller.handleSignOut}
            style={styles.signOutButton}
            variant="secondary"
          >
            Sign Out
          </PrimaryButton>
        </Card>

        {controller.signOutError ? (
          <Banner
            message={controller.signOutError}
            title="Sign out failed"
            variant="error"
          />
        ) : null}

        {controller.loading && !overview ? (
          <LoadingState message="Loading operations overview..." />
        ) : null}

        {controller.error || completeSectionFailure ? (
          <Card variant="elevated">
            <Banner
              message={
                controller.error ??
                "None of the sections available to your role could be retrieved."
              }
              title="Operations overview unavailable"
              variant="error"
            />
            <PrimaryButton
              disabled={controller.loading}
              loading={controller.loading}
              onPress={controller.reload}
            >
              Retry
            </PrimaryButton>
          </Card>
        ) : null}

        {overview && !completeSectionFailure ? (
          <>
            {partialFailure ? (
              <Banner
                message="Some sections could not be refreshed. Available sections are still shown below."
                title="Partial data"
                variant="warning"
              />
            ) : null}

            <View style={styles.section}>
              <SectionHeader
                action={
                  <PrimaryButton
                    disabled={controller.loading}
                    loading={controller.loading}
                    onPress={controller.reload}
                    variant="ghost"
                  >
                    Refresh
                  </PrimaryButton>
                }
                subtitle="Unavailable or restricted counts are never represented as zero."
                title="Current activity"
              />
              <View style={styles.summaryGrid}>
                <SummaryCard label="Active shipments" section={overview.activeShipments} wide={!desktopGrid} />
                <SummaryCard label="Active trips" section={overview.activeTrips} wide={!desktopGrid} />
                <SummaryCard label="Pending booking requests" section={overview.pendingBookingRequests} wide={!desktopGrid} />
                <SummaryCard label="Active bookings" section={overview.activeBookings} wide={!desktopGrid} />
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader
                subtitle="Latest declaration decisions visible to your role."
                title="Recent shipment safety reviews"
              />
              <SafetyReviewList section={overview.recentShipmentSafetyReviews} />
            </View>

            <View style={styles.section}>
              <SectionHeader
                subtitle="Currently active operational or safety restrictions."
                title="Active administrative holds"
              />
              <AdministrativeHoldList section={overview.activeAdministrativeHolds} />
            </View>

            <View style={styles.section}>
              <SectionHeader
                subtitle="Recently created bookings visible to operations roles."
                title="Recent bookings"
              />
              <RecentBookingList section={overview.recentBookings} />
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.huge,
  },
  page: {
    gap: spacing.xl,
  },
  identityCard: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  identityCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  identityLabel: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  identityValue: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  signOutButton: {
    minWidth: 128,
  },
  section: {
    gap: spacing.md,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  summaryCard: {
    minWidth: 0,
  },
  summaryCardWide: {
    flexBasis: "100%",
  },
  summaryCardNarrow: {
    flexBasis: "46%",
    flexGrow: 1,
  },
  summaryLabel: {
    color: colors.textSecondary,
    ...typography.label,
  },
  summaryValue: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  summaryValueMuted: {
    color: colors.textSecondary,
    fontSize: 20,
    lineHeight: 28,
  },
  summaryDetail: {
    color: colors.muted,
    ...typography.caption,
  },
  list: {
    gap: spacing.sm,
  },
  rowHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  rowTitle: {
    color: colors.text,
    flexShrink: 1,
    ...typography.bodyStrong,
  },
  rowDetail: {
    color: colors.textSecondary,
    ...typography.body,
  },
  rowMeta: {
    color: colors.muted,
    ...typography.caption,
  },
});
