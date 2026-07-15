import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";
import { Callout, HeroSection, InfoCard, PageMetadata, PrimaryPublicLink, PublicPageLayout, SecondaryPublicLink, SectionTitle } from "./PublicComponents";

export function PublicHomePage() {
  return (
    <PublicPageLayout>
      <PageMetadata description="Karri helps senders and travelers coordinate trusted community shipping with clear routes, shared responsibility, and accountable records." path="/" title="Karri" />
      <View style={styles.container}>
        <View style={styles.heroPanel}>
          <HeroSection
            actions={<><PrimaryPublicLink href="/about">Discover Karri</PrimaryPublicLink><SecondaryPublicLink href="/trust-center">Visit the Trust Center</SecondaryPublicLink></>}
            eyebrow="Community shipping"
            intro="Karri helps senders and travelers find possible route matches, coordinate package journeys, and move with more clarity."
            title="Connected by community. Guided by trust."
          />
          <View style={styles.routeVisual}>
            <Text style={styles.routeLabel}>A clearer journey</Text>
            <View style={styles.routeStep}><Text style={styles.routeNumber}>1</Text><View><Text style={styles.routeTitle}>Describe</Text><Text style={styles.routeBody}>Share the route and package clearly.</Text></View></View>
            <View style={styles.routeLine} />
            <View style={styles.routeStep}><Text style={styles.routeNumber}>2</Text><View><Text style={styles.routeTitle}>Decide</Text><Text style={styles.routeBody}>Review possible matches and ask questions.</Text></View></View>
            <View style={styles.routeLine} />
            <View style={styles.routeStep}><Text style={styles.routeNumber}>3</Text><View><Text style={styles.routeTitle}>Coordinate</Text><Text style={styles.routeBody}>Keep handoffs and status understandable.</Text></View></View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionIntro}><Text style={styles.overline}>How it helps</Text><SectionTitle>One community, two ways to participate</SectionTitle></View>
          <View style={styles.cardGrid}>
            <InfoCard body="Describe a non-prohibited package, route, and delivery window so travelers can evaluate the request." icon="cube-outline" title="For senders" />
            <InfoCard body="Share a route and available capacity, then decide which requests are lawful, clear, and right for you." icon="airplane-outline" title="For travelers" />
            <InfoCard body="Use shared booking, status, and custody information to make the package journey easier to understand." icon="git-branch-outline" title="For every journey" />
          </View>
        </View>

        <Callout title="Trust is information, not a guarantee" tone="gold">Karri explains limited evidence that can support better questions. Every participant remains responsible for inspection, legal compliance, personal judgment, and safe handoffs.</Callout>

        <View style={styles.section}>
          <View style={styles.sectionIntro}><Text style={styles.overline}>Start with clarity</Text><SectionTitle>Know the expectations before you move</SectionTitle></View>
          <View style={styles.cardGrid}>
            <InfoCard body="Find privacy, legal, safety, prohibited-items, and community policies in one place." href="/trust-center" icon="shield-checkmark-outline" title="Trust Center" />
            <InfoCard body="Get practical answers about accounts, matches, packages, bookings, and custody." href="/faq" icon="help-circle-outline" title="Help Center" />
            <InfoCard body="Ask a question, report a concern, or request help from the Karri team." href="/support" icon="chatbubbles-outline" title="Support" />
          </View>
        </View>
      </View>
    </PublicPageLayout>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "center", gap: spacing.huge, maxWidth: 1180, paddingBottom: spacing.huge, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, width: "100%" },
  heroPanel: { alignItems: "center", backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.xxl, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.xxl, justifyContent: "space-between", padding: spacing.xxxl },
  routeVisual: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xl, borderWidth: 1, flexBasis: 340, flexGrow: 1, gap: spacing.sm, maxWidth: 440, padding: spacing.xl },
  routeLabel: { color: colors.primary, ...typography.overline, textTransform: "uppercase" },
  routeStep: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  routeNumber: { backgroundColor: colors.primary, borderRadius: radii.pill, color: colors.white, fontSize: 15, fontWeight: "800", lineHeight: 36, textAlign: "center", width: 36 },
  routeTitle: { color: colors.text, ...typography.subheading },
  routeBody: { color: colors.textSecondary, ...typography.caption },
  routeLine: { backgroundColor: colors.borderStrong, height: 18, marginLeft: 17, width: 2 },
  section: { gap: spacing.xl },
  sectionIntro: { gap: spacing.xs, maxWidth: 700 },
  overline: { color: colors.primary, ...typography.overline, textTransform: "uppercase" },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
});
