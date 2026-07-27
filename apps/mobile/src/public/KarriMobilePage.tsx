import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors, radii, shadows, spacing, typography } from "../theme/tokens";
import {
  Callout,
  InfoCard,
  PageMetadata,
  PublicPageLayout,
  SectionTitle,
} from "./PublicComponents";
import {
  FAQ_PREVIEW,
  HOW_KARRI_WORKS,
  KARRI_FEATURES,
  KARRI_MOBILE_DESCRIPTION,
  KARRI_MOBILE_PATH,
  KARRI_MOBILE_TITLE,
  SAFETY_REMINDERS,
} from "./karriMobileContent";

export function KarriMobilePage() {
  const { width } = useWindowDimensions();
  const compact = width < 720;

  return (
    <PublicPageLayout marketing>
      <PageMetadata
        description={KARRI_MOBILE_DESCRIPTION}
        fullTitle={KARRI_MOBILE_TITLE}
        path={KARRI_MOBILE_PATH}
        title="Karri Mobile"
      />

      <View style={styles.container}>
        <View style={[styles.heroPanel, compact && styles.heroPanelCompact]}>
          <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowIcon}>
                <Ionicons color={colors.primary} name="people-outline" size={18} />
              </View>
              <Text style={styles.eyebrow}>Community shipping for East African diaspora communities</Text>
            </View>
            <Text
              accessibilityRole="header"
              aria-level={1}
              style={[styles.heroTitle, compact && styles.heroTitleCompact]}
            >
              Move across borders with more clarity.
            </Text>
            <Text style={styles.heroIntro}>
              Karri helps senders and travelers coordinate community shipping through clear
              listings, compatible routes, booking requests, custody expectations, and status
              updates.
            </Text>
            <View style={styles.heroActions}>
              <Link accessibilityRole="link" href="/karri-mobile#how-it-works" style={styles.primaryAction}>
                Learn how Karri works
              </Link>
              <View accessibilityRole="text" style={styles.comingSoon}>
                <Ionicons color={colors.primaryDark} name="phone-portrait-outline" size={19} />
                <Text style={styles.comingSoonText}>Coming soon on the App Store</Text>
              </View>
            </View>
            <Text style={styles.releaseNote}>
              Public download is not yet available. This page describes the current Karri Mobile
              experience and planned MVP workflows.
            </Text>
          </View>

          <View
            accessibilityLabel="Illustration of a Karri shipment route moving from a sender listing to a traveler trip and coordinated handoff"
            accessibilityRole="image"
            style={[styles.routePreview, compact && styles.routePreviewCompact]}
          >
            <View style={styles.routePreviewHeader}>
              <Text style={styles.routePreviewLabel}>A clearer community route</Text>
              <View style={styles.possibleMatchBadge}>
                <Text style={styles.possibleMatchText}>Possible match</Text>
              </View>
            </View>
            <View style={styles.routePlace}>
              <View style={styles.routeDot}>
                <Ionicons color={colors.white} name="cube-outline" size={18} />
              </View>
              <View style={styles.routePlaceCopy}>
                <Text style={styles.routePlaceLabel}>Sender listing</Text>
                <Text style={styles.routePlaceTitle}>Package details shared</Text>
              </View>
            </View>
            <View style={styles.routeLine}>
              <Ionicons color={colors.primary} name="airplane" size={20} />
            </View>
            <View style={styles.routePlace}>
              <View style={[styles.routeDot, styles.routeDotGold]}>
                <Ionicons color={colors.white} name="airplane-outline" size={18} />
              </View>
              <View style={styles.routePlaceCopy}>
                <Text style={styles.routePlaceLabel}>Traveler trip</Text>
                <Text style={styles.routePlaceTitle}>Route and capacity shared</Text>
              </View>
            </View>
            <View style={styles.routeSummary}>
              <Ionicons color={colors.primary} name="information-circle-outline" size={20} />
              <Text style={styles.routeSummaryText}>
                Both people review the details and decide what happens next.
              </Text>
            </View>
          </View>
        </View>

        <View
          aria-label="How Karri works"
          nativeID="how-it-works"
          role="region"
          style={styles.section}
        >
          <View style={styles.sectionIntro}>
            <Text style={styles.overline}>How Karri works</Text>
            <SectionTitle>From a listing to a coordinated handoff</SectionTitle>
            <Text style={styles.sectionBody}>
              Karri keeps the essential route, request, custody, and status information connected
              across five straightforward steps.
            </Text>
          </View>
          <View style={styles.steps}>
            {HOW_KARRI_WORKS.map((step, index) => (
              <View key={step.title} style={styles.stepCard}>
                <Text aria-hidden style={styles.stepNumber}>{index + 1}</Text>
                <View style={styles.stepCopy}>
                  <Text accessibilityRole="header" aria-level={3} style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View aria-label="Karri Mobile features" role="region" style={styles.section}>
          <View style={styles.sectionIntro}>
            <Text style={styles.overline}>Built for clear coordination</Text>
            <SectionTitle>The details people need, kept understandable</SectionTitle>
            <Text style={styles.sectionBody}>
              Each part of the MVP helps senders and travelers make a more informed decision and
              keep the journey easier to follow.
            </Text>
          </View>
          <View style={styles.featureGrid}>
            {KARRI_FEATURES.map((feature) => (
              <InfoCard
                body={feature.body}
                icon={feature.icon}
                key={feature.title}
                title={feature.title}
              />
            ))}
          </View>
        </View>

        <View aria-label="Safety and trust" role="region" style={styles.safetyPanel}>
          <View style={styles.safetyCopy}>
            <Text style={styles.overline}>Safety and trust</Text>
            <SectionTitle>Clarity supports safer decisions</SectionTitle>
            <Text style={styles.sectionBody}>
              Before any handoff, verify package contents, confirm airline and customs
              requirements, avoid prohibited or restricted items, and agree clearly on custody,
              timing, and handoff details.
            </Text>
            <View style={styles.reminderList}>
              {SAFETY_REMINDERS.map((reminder) => (
                <View key={reminder} style={styles.reminderRow}>
                  <Ionicons color={colors.primary} name="checkmark-circle-outline" size={21} />
                  <Text style={styles.reminderText}>{reminder}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.safetyLinks}>
            <InfoCard body="Review practical precautions for sending, carrying, and handing off packages." href="/safety" icon="shield-checkmark-outline" title="Safety" />
            <InfoCard body="Understand Karri’s trust principles, policies, and shared-responsibility model." href="/trust-center" icon="information-circle-outline" title="Trust Center" />
            <InfoCard body="Read the responsibilities and limitations that apply when using Karri." href="/terms-of-service" icon="document-text-outline" title="Terms of Service" />
          </View>
        </View>

        <Callout title="Important limitations" tone="gold">
          Profile completion is not the same as verified identity. Karri does not guarantee
          delivery. Senders and travelers remain responsible for legal, airline, and customs
          compliance throughout the route.
        </Callout>

        <View aria-label="Frequently asked questions preview" role="region" style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionIntro}>
              <Text style={styles.overline}>Quick answers</Text>
              <SectionTitle>Questions about Karri Mobile</SectionTitle>
              <Text style={styles.sectionBody}>
                A short introduction to the current experience. The full Help Center has more
                detailed guidance.
              </Text>
            </View>
            <Link accessibilityRole="link" href="/faq" style={styles.textLink}>View all FAQs</Link>
          </View>
          <View style={styles.faqGrid}>
            {FAQ_PREVIEW.map((item) => (
              <View key={item.question} style={styles.faqCard}>
                <Text accessibilityRole="header" aria-level={3} style={styles.faqQuestion}>{item.question}</Text>
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              </View>
            ))}
          </View>
        </View>

        <View aria-label="Karri support" role="region" style={styles.supportPanel}>
          <View style={styles.supportIcon}>
            <Ionicons color={colors.white} name="chatbubbles-outline" size={27} />
          </View>
          <View style={styles.supportCopy}>
            <Text style={styles.supportEyebrow}>Need a hand?</Text>
            <Text accessibilityRole="header" aria-level={2} style={styles.supportTitle}>
              Find guidance or talk with the Karri team.
            </Text>
            <Text style={styles.supportBody}>
              Visit Support for product and account help, or Contact for general questions and
              requests.
            </Text>
          </View>
          <View style={styles.supportActions}>
            <Link accessibilityRole="link" href="/support" style={styles.supportPrimary}>Visit Support</Link>
            <Link accessibilityRole="link" href="/contact" style={styles.supportSecondary}>Contact Karri</Link>
          </View>
        </View>
      </View>
    </PublicPageLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    gap: 72,
    maxWidth: 1180,
    paddingBottom: 72,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    width: "100%",
  },
  heroPanel: {
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: radii.xxl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xxxl,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: spacing.xxxl,
  },
  heroPanelCompact: { alignItems: "stretch", flexDirection: "column", padding: spacing.xl },
  heroCopy: { flex: 1, gap: spacing.lg, minWidth: 0 },
  heroCopyCompact: { flex: 0 },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  eyebrowIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  eyebrow: { color: colors.primary, flex: 1, ...typography.overline, textTransform: "uppercase" },
  heroTitle: { color: colors.text, fontSize: 52, fontWeight: "800", letterSpacing: -1.4, lineHeight: 58 },
  heroTitleCompact: { fontSize: 39, letterSpacing: -0.9, lineHeight: 45 },
  heroIntro: { color: colors.textSecondary, fontSize: 19, lineHeight: 29, maxWidth: 660 },
  heroActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    paddingVertical: 15,
    textAlign: "center",
    textDecorationLine: "none",
  },
  comingSoon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  comingSoonText: { color: colors.primaryDark, ...typography.label },
  releaseNote: { color: colors.muted, fontSize: 13, lineHeight: 19, maxWidth: 620 },
  routePreview: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexBasis: 360,
    flexGrow: 1,
    gap: spacing.lg,
    maxWidth: 440,
    minWidth: 280,
    padding: spacing.xl,
    ...shadows.low,
  },
  routePreviewCompact: {
    flexBasis: "auto" as never,
    flexGrow: 0,
    maxWidth: "100%",
    minWidth: 0,
    width: "100%",
  },
  routePreviewHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" },
  routePreviewLabel: { color: colors.text, ...typography.label },
  possibleMatchBadge: { backgroundColor: colors.skySoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  possibleMatchText: { color: colors.sky, fontSize: 12, fontWeight: "800" },
  routePlace: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  routeDot: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.pill, height: 42, justifyContent: "center", width: 42 },
  routeDotGold: { backgroundColor: colors.gold },
  routePlaceCopy: { flex: 1, gap: spacing.xxs },
  routePlaceLabel: { color: colors.muted, ...typography.caption },
  routePlaceTitle: { color: colors.text, ...typography.subheading },
  routeLine: { alignItems: "center", borderLeftColor: colors.borderStrong, borderLeftWidth: 2, height: 42, justifyContent: "center", marginLeft: 20, width: 32 },
  routeSummary: { alignItems: "flex-start", backgroundColor: colors.primarySoft, borderRadius: radii.md, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  routeSummaryText: { color: colors.primaryDark, flex: 1, ...typography.caption },
  section: { gap: spacing.xl },
  sectionIntro: { gap: spacing.sm, maxWidth: 760 },
  overline: { color: colors.primary, ...typography.overline, textTransform: "uppercase" },
  sectionBody: { color: colors.textSecondary, ...typography.body },
  steps: { gap: spacing.sm },
  stepCard: { alignItems: "flex-start", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  stepNumber: { backgroundColor: colors.primary, borderRadius: radii.pill, color: colors.white, fontSize: 15, fontWeight: "800", lineHeight: 36, textAlign: "center", width: 36 },
  stepCopy: { flex: 1, gap: spacing.xs },
  stepTitle: { color: colors.text, ...typography.subheading },
  stepBody: { color: colors.textSecondary, ...typography.body },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  safetyPanel: { alignItems: "flex-start", backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.xxl, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.xxxl, padding: spacing.xxxl },
  safetyCopy: { flex: 1, gap: spacing.md, minWidth: 280 },
  reminderList: { gap: spacing.sm, paddingTop: spacing.xs },
  reminderRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  reminderText: { color: colors.textSecondary, flex: 1, ...typography.body },
  safetyLinks: { flex: 1, gap: spacing.sm, minWidth: 280 },
  sectionHeadingRow: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, justifyContent: "space-between" },
  textLink: { color: colors.primary, fontSize: 15, fontWeight: "800", paddingVertical: spacing.sm },
  faqGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  faqCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexBasis: 340, flexGrow: 1, gap: spacing.sm, minWidth: 280, padding: spacing.lg },
  faqQuestion: { color: colors.text, ...typography.subheading },
  faqAnswer: { color: colors.textSecondary, ...typography.body },
  supportPanel: { alignItems: "center", backgroundColor: colors.forest, borderRadius: radii.xxl, flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, padding: spacing.xxxl },
  supportIcon: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.lg, height: 56, justifyContent: "center", width: 56 },
  supportCopy: { flex: 1, gap: spacing.xs, minWidth: 260 },
  supportEyebrow: { color: "#A9D4BC", ...typography.overline, textTransform: "uppercase" },
  supportTitle: { color: colors.white, ...typography.headline },
  supportBody: { color: "#CBD8D0", ...typography.body },
  supportActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  supportPrimary: { backgroundColor: colors.white, borderRadius: radii.md, color: colors.forest, fontSize: 15, fontWeight: "800", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, textAlign: "center", textDecorationLine: "none" },
  supportSecondary: { borderColor: "#6D8176", borderRadius: radii.md, borderWidth: 1, color: colors.white, fontSize: 15, fontWeight: "800", paddingHorizontal: spacing.lg, paddingVertical: 15, textAlign: "center", textDecorationLine: "none" },
});
