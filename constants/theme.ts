export type ThemeColors = {
  primary: string;
  secondary: string;
  tertiary: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textInverted: string;
  border: string;
  success: string;
  primaryLight: string;
  messageReceived: string;
  /** Soft accent wash for highlights */
  accentSoft: string;
  /** Grouped list background (Messages inbox) */
  inboxBackground: string;
  /** Elevated card surface inside grouped lists */
  inboxSurface: string;
  /** Search field / inactive filter pill */
  inboxSearch: string;
  /** Row dividers */
  inboxSeparator: string;
  /** Pressed list row */
  inboxRowPressed: string;
  /** Sent message bubble */
  bubbleSent: string;
  /** Received message bubble */
  bubbleReceived: string;
  bubbleSentText: string;
  bubbleReceivedText: string;
  /** iOS-style link / accent blue */
  link: string;
  /** Secondary labels, timestamps */
  muted: string;
  /** Chevron / tertiary icons */
  chevron: string;
  /** Frosted header / menu panels */
  frostedPanel: string;
  frostedOverlay: string;
  composerBar: string;
  destructive: string;
  /** Screen headers (Messages, etc.) */
  headerBackground: string;
  headerText: string;
  headerSubtext: string;
  /** Card shadow tint */
  shadow: string;
};

export const lightColors: ThemeColors = {
  primary: "#0F172A",
  secondary: "#0EA5E9",
  tertiary: "#14B8A6",
  background: "#F1F5F9",
  surface: "#FFFFFF",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textInverted: "#FFFFFF",
  border: "#CBD5E1",
  success: "#10B981",
  primaryLight: "#E0F2FE",
  messageReceived: "#F1F5F9",
  accentSoft: "#E0F2FE",
  inboxBackground: "#E2E8F0",
  inboxSurface: "#FFFFFF",
  inboxSearch: "#CBD5E1",
  inboxSeparator: "#CBD5E1",
  inboxRowPressed: "#E2E8F0",
  bubbleSent: "#0284C7",
  bubbleReceived: "#E2E8F0",
  bubbleSentText: "#FFFFFF",
  bubbleReceivedText: "#0F172A",
  link: "#0284C7",
  muted: "#94A3B8",
  chevron: "#CBD5E1",
  frostedPanel: "rgba(255,255,255,0.94)",
  frostedOverlay: "rgba(241,245,249,0.88)",
  composerBar: "#FFFFFF",
  destructive: "#EF4444",
  headerBackground: "#0F172A",
  headerText: "#FFFFFF",
  headerSubtext: "#94A3B8",
  shadow: "#0EA5E9",
};

export const darkColors: ThemeColors = {
  primary: "#F8FAFC",
  secondary: "#38BDF8",
  tertiary: "#2DD4BF",
  background: "#0B1120",
  surface: "#131A2B",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textInverted: "#0B1120",
  border: "#1E293B",
  success: "#34D399",
  primaryLight: "#0C4A6E",
  messageReceived: "#1E293B",
  accentSoft: "#0F2847",
  inboxBackground: "#0B1120",
  inboxSurface: "#131A2B",
  inboxSearch: "#1E293B",
  inboxSeparator: "#1E293B",
  inboxRowPressed: "#1A2332",
  bubbleSent: "#0284C7",
  bubbleReceived: "#1E293B",
  bubbleSentText: "#FFFFFF",
  bubbleReceivedText: "#F8FAFC",
  link: "#38BDF8",
  muted: "#64748B",
  chevron: "#475569",
  frostedPanel: "rgba(19,26,43,0.96)",
  frostedOverlay: "rgba(11,17,32,0.85)",
  composerBar: "#131A2B",
  destructive: "#F87171",
  headerBackground: "#0F172A",
  headerText: "#F8FAFC",
  headerSubtext: "#64748B",
  shadow: "#000000",
};

export const typography = {
  fontFamily: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semiBold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  sizes: {
    h1: 24,
    h2: 20,
    title: 18,
    body: 16,
    subbody: 14,
    caption: 12,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export type AppTheme = {
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
};

export function createTheme(colors: ThemeColors): AppTheme {
  return { colors, typography, spacing, borderRadius };
}

export const lightTheme = createTheme(lightColors);
export const darkTheme = createTheme(darkColors);

/** @deprecated Use `useAppTheme()` for theme-aware colors */
export const Theme = lightTheme;

/** Legacy hook support for Expo template components */
export const Colors = {
  light: lightColors,
  dark: darkColors,
};
