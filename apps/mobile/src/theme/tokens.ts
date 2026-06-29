export const colors = {
  background: "#F8F6F0",
  backgroundStrong: "#F1EEE5",
  surface: "#FFFFFF",
  surfaceSoft: "#F1F6F2",
  surfaceMuted: "#F5F6F3",
  primary: "#276749",
  primaryPressed: "#1E5039",
  primarySoft: "#E5F2EA",
  primaryDark: "#173D2D",
  forest: "#172A21",
  text: "#172A21",
  textSecondary: "#506057",
  muted: "#718078",
  border: "#DCE4DE",
  borderStrong: "#C6D3CA",
  sky: "#347EB8",
  skySoft: "#E8F3FA",
  gold: "#B8872D",
  goldSoft: "#FBF3DF",
  success: "#2F7D57",
  successSoft: "#E6F4EC",
  warning: "#AD681C",
  warningSoft: "#FFF1D9",
  error: "#B54740",
  errorSoft: "#FCEBE9",
  white: "#FFFFFF",
  shadow: "#13251C",
  overlay: "rgba(23, 42, 33, 0.48)",
};

export const typography = {
  display: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800" as const,
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800" as const,
    letterSpacing: -0.45,
  },
  headline: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800" as const,
    letterSpacing: -0.2,
  },
  subheading: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700" as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700" as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500" as const,
  },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800" as const,
    letterSpacing: 0.8,
  },
};

export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 30,
  pill: 999,
};

export const elevation = {
  none: 0,
  low: 2,
  medium: 5,
  high: 9,
};

export const shadows = {
  none: {
    shadowOpacity: 0,
    elevation: elevation.none,
  },
  low: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: elevation.low,
  },
  medium: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: elevation.medium,
  },
};

export const layout = {
  contentMaxWidth: 560,
  screenPaddingHorizontal: spacing.lg,
  screenPaddingTop: spacing.lg,
  screenPaddingBottom: spacing.xxl,
  screenPaddingBottomWithTabBar: 104,
  sectionGap: spacing.xxl,
  cardPadding: spacing.lg,
  tabBarMinHeight: 68,
};

export const touchTargets = {
  minimum: 44,
  comfortable: 52,
  large: 56,
  hitSlop: 8,
};
