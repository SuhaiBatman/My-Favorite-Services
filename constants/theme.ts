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
};

export const lightColors: ThemeColors = {
  primary: "#0F172A",
  secondary: "#3B82F6",
  tertiary: "#2DD4BF",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textInverted: "#FFFFFF",
  border: "#E2E8F0",
  success: "#10B981",
  primaryLight: "#E0E7FF",
  messageReceived: "#F1F5F9",
  inboxBackground: "#F2F2F7",
  inboxSurface: "#FFFFFF",
  inboxSearch: "#E3E3E8",
  inboxSeparator: "#C6C6C8",
  inboxRowPressed: "#E5E5EA",
  bubbleSent: "#000000",
  bubbleReceived: "#E9E9EB",
  bubbleSentText: "#FFFFFF",
  bubbleReceivedText: "#000000",
  link: "#007AFF",
  muted: "#8E8E93",
  chevron: "#C7C7CC",
  frostedPanel: "rgba(248,248,248,0.94)",
  frostedOverlay: "rgba(248,248,248,0.72)",
  composerBar: "rgba(248,248,248,0.96)",
  destructive: "#FF3B30",
};

export const darkColors: ThemeColors = {
  primary: "#F8FAFC",
  secondary: "#60A5FA",
  tertiary: "#2DD4BF",
  background: "#0B1120",
  surface: "#1E293B",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textInverted: "#0F172A",
  border: "#334155",
  success: "#34D399",
  primaryLight: "#1E3A5F",
  messageReceived: "#334155",
  inboxBackground: "#000000",
  inboxSurface: "#1C1C1E",
  inboxSearch: "#2C2C2E",
  inboxSeparator: "#38383A",
  inboxRowPressed: "#2C2C2E",
  bubbleSent: "#0A84FF",
  bubbleReceived: "#3A3A3C",
  bubbleSentText: "#FFFFFF",
  bubbleReceivedText: "#FFFFFF",
  link: "#0A84FF",
  muted: "#8E8E93",
  chevron: "#636366",
  frostedPanel: "rgba(28,28,30,0.94)",
  frostedOverlay: "rgba(44,44,46,0.72)",
  composerBar: "rgba(28,28,30,0.96)",
  destructive: "#FF453A",
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
