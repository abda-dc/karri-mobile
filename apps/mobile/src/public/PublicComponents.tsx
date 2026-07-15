import { Ionicons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import Head from "expo-router/head";
import { ReactNode, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors, radii, shadows, spacing, typography } from "../theme/tokens";
import { PUBLIC_SITE_URL, PublicPageContent, PublicRoute, publicRouteLabels } from "./publicContent";

const primaryNavigation: { href: PublicRoute; label: string }[] = [
  { href: "/about", label: "About" },
  { href: "/trust-center", label: "Trust Center" },
  { href: "/support", label: "Support" },
  { href: "/faq", label: "Help Center" },
];

const footerGroups: { title: string; links: { href: PublicRoute; label: string }[] }[] = [
  { title: "Explore", links: [{ href: "/about", label: "About" }, { href: "/trust-center", label: "Trust Center" }, { href: "/support", label: "Support" }, { href: "/contact", label: "Contact" }] },
  { title: "Legal", links: [{ href: "/privacy-policy", label: "Privacy Policy" }, { href: "/delete-account", label: "Delete Account" }, { href: "/terms-of-service", label: "Terms of Service" }, { href: "/safety", label: "Safety Policy" }] },
  { title: "Company", links: [{ href: "/careers", label: "Careers" }, { href: "/press", label: "Press" }] },
];

function PublicLink({ href, children, style }: { href: PublicRoute; children: ReactNode; style?: object }) {
  return (
    <Link accessibilityRole="link" href={href as never} style={style}>
      {children}
    </Link>
  );
}

export function PageMetadata({ title, description, path }: Pick<PublicPageContent, "title" | "description" | "path">) {
  const canonical = `${PUBLIC_SITE_URL}${path === "/" ? "" : path}`;
  const fullTitle = title === "Karri" ? "Karri — Community shipping with clarity" : `${title} | Karri`;
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Karri" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <link rel="canonical" href={canonical} />
    </Head>
  );
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  return (
    <View role="banner" style={styles.header}>
      <View style={styles.headerInner}>
        <Link asChild href="/">
          <Pressable accessibilityRole="link" style={styles.brandLink}>
          <View style={styles.brandRow}>
            <Image accessibilityLabel="Karri home" source={require("../../assets/karri-logo.jpeg")} style={styles.logo} />
            <Text style={styles.brandText}>Karri</Text>
          </View>
          </Pressable>
        </Link>
        <View role="navigation" aria-label="Primary navigation" style={[styles.desktopNav, compact && styles.hidden]}>
          {primaryNavigation.map((item) => (
            <PublicLink href={item.href} key={item.href} style={[styles.navLink, pathname === item.href && styles.navLinkActive]}>{item.label}</PublicLink>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? "Close navigation menu" : "Open navigation menu"}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}
          style={({ pressed }) => [styles.menuButton, !compact && styles.hidden, pressed && styles.pressed]}
        >
          <Ionicons color={colors.text} name={open ? "close" : "menu"} size={26} />
        </Pressable>
      </View>
      {open ? (
        <View role="navigation" aria-label="Mobile navigation" style={styles.mobileNav}>
          {primaryNavigation.map((item) => (
            <PublicLink href={item.href} key={item.href} style={[styles.mobileNavLink, pathname === item.href && styles.mobileNavLinkActive]}>{item.label}</PublicLink>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function PublicFooter() {
  return (
    <View role="contentinfo" style={styles.footer}>
      <View style={styles.footerInner}>
        <View style={styles.footerBrand}>
          <Text style={styles.footerBrandTitle}>Karri</Text>
          <Text style={styles.footerDescription}>Trusted community shipping between travelers and senders.</Text>
        </View>
        <View style={styles.footerLinks}>
          {footerGroups.map((group) => (
            <View key={group.title} style={styles.footerGroup}>
              <Text accessibilityRole="header" aria-level={2} style={styles.footerHeading}>{group.title}</Text>
              {group.links.map((item) => <PublicLink href={item.href} key={item.href} style={styles.footerLink}>{item.label}</PublicLink>)}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.copyrightRow}>
        <Text style={styles.copyright}>© 2026 M7SK Technologies</Text>
        <Text style={styles.copyright}>Community-first. Built with care.</Text>
      </View>
    </View>
  );
}

export function PublicPageLayout({ children }: { children: ReactNode }) {
  return (
    <View style={styles.pageShell}>
      <PublicHeader />
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
        <View role="main" style={styles.main}>{children}</View>
        <PublicFooter />
      </ScrollView>
    </View>
  );
}

export function Breadcrumbs({ current }: { current: string }) {
  return (
    <View role="navigation" aria-label="Breadcrumb" style={styles.breadcrumbs}>
      <PublicLink href="/" style={styles.breadcrumbLink}>Home</PublicLink>
      <Text aria-hidden style={styles.breadcrumbSeparator}>/</Text>
      <Text accessibilityRole="text" style={styles.breadcrumbCurrent}>{current}</Text>
    </View>
  );
}

export function HeroSection({ eyebrow, title, intro, actions }: { eyebrow: string; title: string; intro: string; actions?: ReactNode }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" aria-level={1} style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroIntro}>{intro}</Text>
      {actions ? <View style={styles.heroActions}>{actions}</View> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{children}</Text>;
}

export function InfoCard({ title, body, href, icon = "arrow-forward" }: { title: string; body: string; href?: PublicRoute; icon?: keyof typeof Ionicons.glyphMap }) {
  const content = (
    <View style={styles.infoCardInner}>
      <View style={styles.infoIcon}><Ionicons color={colors.primary} name={icon} size={22} /></View>
      <View style={styles.infoCopy}>
        <Text accessibilityRole="header" aria-level={3} style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoBody}>{body}</Text>
      </View>
      {href ? <Ionicons color={colors.primary} name="arrow-forward" size={20} /> : null}
    </View>
  );
  return href ? <Link asChild href={href as never}><Pressable accessibilityRole="link" style={styles.infoCardLink}>{content}</Pressable></Link> : <View style={styles.infoCard}>{content}</View>;
}

export function Callout({ title, children, tone = "green" }: { title: string; children: ReactNode; tone?: "green" | "gold" | "blue" }) {
  return (
    <View accessibilityRole="summary" style={[styles.callout, tone === "gold" && styles.calloutGold, tone === "blue" && styles.calloutBlue]}>
      <Text accessibilityRole="header" aria-level={2} style={styles.calloutTitle}>{title}</Text>
      <Text style={styles.calloutBody}>{children}</Text>
    </View>
  );
}

export function DocumentNavigation({ sections, path }: Pick<PublicPageContent, "sections" | "path">) {
  return (
    <View role="navigation" aria-label="On this page" style={styles.documentNav}>
      <Text accessibilityRole="header" aria-level={2} style={styles.documentNavTitle}>On this page</Text>
      <View style={styles.documentNavLinks}>
        {sections.map((section) => <Link accessibilityRole="link" href={`${path}#${section.id}` as never} key={section.id} style={styles.documentNavLink}>• {section.title}</Link>)}
      </View>
    </View>
  );
}

export function RelatedDocuments({ routes }: { routes: PublicRoute[] }) {
  return (
    <View style={styles.relatedSection}>
      <SectionTitle>Related information</SectionTitle>
      <View style={styles.relatedGrid}>
        {routes.map((route) => <InfoCard body={`Read ${publicRouteLabels[route]} on Karri.`} href={route} key={route} title={publicRouteLabels[route]} />)}
      </View>
    </View>
  );
}

export function LegalPageLayout({ page }: { page: PublicPageContent }) {
  return <PublicContentPage page={page} legal />;
}

export function PublicContentPage({ page, legal = false }: { page: PublicPageContent; legal?: boolean }) {
  const { width } = useWindowDimensions();
  const compact = width < 880;
  return (
    <PublicPageLayout>
      <PageMetadata description={page.description} path={page.path} title={page.title} />
      <View style={styles.contentContainer}>
        <Breadcrumbs current={page.title} />
        <HeroSection eyebrow={page.eyebrow} intro={page.intro} title={page.heading} />
        {page.updated ? <Text style={styles.updated}>Effective and last updated: {page.updated}</Text> : null}
        {legal ? <Callout title="Please read carefully" tone="gold">These policies explain important rights, responsibilities, and limitations. More restrictive laws, airport rules, customs requirements, or carrier policies always apply.</Callout> : null}
        <View style={[styles.documentLayout, compact && styles.documentLayoutCompact]}>
          <DocumentNavigation path={page.path} sections={page.sections} />
          <View style={styles.article}>
            {page.sections.map((section) => (
              <View key={section.id} nativeID={section.id} style={styles.articleSection}>
                <SectionTitle>{section.title}</SectionTitle>
                {section.paragraphs?.map((paragraph) => <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}
                {section.bullets ? (
                  <View style={styles.bulletList}>
                    {section.bullets.map((bullet) => (
                      <View key={bullet} style={styles.bulletRow}>
                        <Text aria-hidden style={styles.bullet}>•</Text>
                        <Text style={styles.bulletText}>{bullet}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
        <RelatedDocuments routes={page.related} />
      </View>
    </PublicPageLayout>
  );
}

export function PrimaryPublicLink({ href, children }: { href: PublicRoute; children: ReactNode }) {
  return <PublicLink href={href} style={styles.primaryLink}>{children}</PublicLink>;
}

export function SecondaryPublicLink({ href, children }: { href: PublicRoute; children: ReactNode }) {
  return <PublicLink href={href} style={styles.secondaryLink}>{children}</PublicLink>;
}

const styles = StyleSheet.create({
  pageShell: { backgroundColor: colors.background, flex: 1, minHeight: "100%" as never },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: { backgroundColor: colors.background, borderBottomColor: colors.border, borderBottomWidth: 1, zIndex: 10 },
  headerInner: { alignItems: "center", alignSelf: "center", flexDirection: "row", justifyContent: "space-between", maxWidth: 1180, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, width: "100%" },
  brandLink: {},
  brandRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  logo: { borderRadius: radii.md, height: 44, width: 44 },
  brandText: { color: colors.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 },
  desktopNav: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  navLink: { borderRadius: radii.pill, color: colors.textSecondary, fontSize: 15, fontWeight: "700", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textDecorationLine: "none" },
  navLinkActive: { backgroundColor: colors.primarySoft, color: colors.primaryDark },
  menuButton: { alignItems: "center", borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  hidden: { display: "none" },
  pressed: { opacity: 0.7 },
  mobileNav: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, padding: spacing.md },
  mobileNavLink: { borderRadius: radii.md, color: colors.text, fontSize: 16, fontWeight: "700", padding: spacing.md, textDecorationLine: "none" },
  mobileNavLinkActive: { backgroundColor: colors.primarySoft, color: colors.primaryDark },
  main: { flexGrow: 1 },
  contentContainer: { alignSelf: "center", maxWidth: 1180, paddingBottom: spacing.huge, paddingHorizontal: spacing.lg, width: "100%" },
  breadcrumbs: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, paddingTop: spacing.xl },
  breadcrumbLink: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  breadcrumbSeparator: { color: colors.muted },
  breadcrumbCurrent: { color: colors.textSecondary, fontSize: 14 },
  hero: { gap: spacing.md, maxWidth: 820, paddingBottom: spacing.xxl, paddingTop: spacing.xxxl },
  eyebrow: { color: colors.primary, ...typography.overline, textTransform: "uppercase" },
  heroTitle: { color: colors.text, fontSize: 48, fontWeight: "800", letterSpacing: -1.2, lineHeight: 55 },
  heroIntro: { color: colors.textSecondary, fontSize: 20, lineHeight: 30, maxWidth: 760 },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.sm },
  updated: { color: colors.muted, fontSize: 14, fontWeight: "600", marginBottom: spacing.xl },
  sectionTitle: { color: colors.text, ...typography.headline },
  documentLayout: { alignItems: "flex-start", flexDirection: "row", gap: spacing.xxxl, paddingTop: spacing.xxl },
  documentLayoutCompact: { flexDirection: "column" },
  documentNav: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.md, padding: spacing.lg, width: Platform.OS === "web" ? 270 : "100%" },
  documentNavTitle: { color: colors.text, ...typography.subheading },
  documentNavLinks: { gap: spacing.sm },
  documentNavLink: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  article: { flex: 1, gap: spacing.xxxl, maxWidth: 760, minWidth: 0 },
  articleSection: { gap: spacing.md },
  paragraph: { color: colors.textSecondary, ...typography.body },
  bulletList: { gap: spacing.sm },
  bulletRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  bullet: { color: colors.primary, fontSize: 18, lineHeight: 24 },
  bulletText: { color: colors.textSecondary, flex: 1, ...typography.body },
  callout: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderLeftWidth: 4, borderRadius: radii.md, gap: spacing.xs, maxWidth: 900, padding: spacing.lg },
  calloutGold: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  calloutBlue: { backgroundColor: colors.skySoft, borderColor: colors.sky },
  calloutTitle: { color: colors.text, ...typography.subheading },
  calloutBody: { color: colors.textSecondary, ...typography.body },
  relatedSection: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.lg, marginTop: spacing.huge, paddingTop: spacing.xxxl },
  relatedGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  infoCardLink: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexBasis: 300, flexGrow: 1, minWidth: 250, padding: spacing.lg, textDecorationLine: "none", ...shadows.low },
  infoCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexBasis: 300, flexGrow: 1, minWidth: 250, padding: spacing.lg },
  infoCardInner: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  infoIcon: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radii.md, height: 44, justifyContent: "center", width: 44 },
  infoCopy: { flex: 1, gap: spacing.xs },
  infoTitle: { color: colors.text, ...typography.subheading },
  infoBody: { color: colors.textSecondary, ...typography.caption },
  primaryLink: { backgroundColor: colors.primary, borderRadius: radii.md, color: colors.white, fontSize: 16, fontWeight: "800", minHeight: 52, paddingHorizontal: spacing.xl, paddingVertical: 15, textAlign: "center", textDecorationLine: "none" },
  secondaryLink: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.md, borderWidth: 1, color: colors.primaryDark, fontSize: 16, fontWeight: "800", minHeight: 52, paddingHorizontal: spacing.xl, paddingVertical: 14, textAlign: "center", textDecorationLine: "none" },
  footer: { backgroundColor: colors.forest, marginTop: "auto" as never, paddingHorizontal: spacing.lg, paddingVertical: spacing.huge },
  footerInner: { alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.huge, justifyContent: "space-between", maxWidth: 1180, width: "100%" },
  footerBrand: { gap: spacing.sm, maxWidth: 320 },
  footerBrandTitle: { color: colors.white, ...typography.headline },
  footerDescription: { color: "#CBD8D0", ...typography.body },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", gap: spacing.huge },
  footerGroup: { gap: spacing.sm, minWidth: 135 },
  footerHeading: { color: colors.white, ...typography.label },
  footerLink: { color: "#CBD8D0", fontSize: 14, lineHeight: 22 },
  copyrightRow: { alignSelf: "center", borderTopColor: "#385044", borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between", marginTop: spacing.xxxl, maxWidth: 1180, paddingTop: spacing.lg, width: "100%" },
  copyright: { color: "#AFC0B6", fontSize: 13 },
});
