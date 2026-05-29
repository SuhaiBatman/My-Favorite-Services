import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    type SharedValue,
} from "react-native-reanimated";
import type { AppTheme } from "../constants/theme";
import { useAppTheme } from "../contexts/ThemeContext";
import { useThemedStyles } from "../hooks/use-themed-styles";

const USE_NATIVE_GLASS = Platform.OS === "ios" && isGlassEffectAPIAvailable();

const BUBBLE_INSET_H = 5;
const BUBBLE_INSET_V = 6;

type LiquidGlassChromeProps = {
  width: number;
  height: number;
  pillWidth: number;
  gap: number;
  tabWidth: number;
  bubbleX: SharedValue<number>;
  children?: React.ReactNode;
  fab?: React.ReactNode;
  hasFab?: boolean;
};

function SelectionBubble({
  height,
  radius,
  tabWidth,
  bubbleX,
}: {
  height: number;
  radius: number;
  tabWidth: number;
  bubbleX: SharedValue<number>;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleX.value + BUBBLE_INSET_H }],
    width: tabWidth - BUBBLE_INSET_H * 2,
  }));

  const bubbleRadius = radius - BUBBLE_INSET_V;
  const bubbleHeight = height - BUBBLE_INSET_V * 2;

  return (
    <Animated.View
      style={[
        styles.bubble,
        { height: bubbleHeight, borderRadius: bubbleRadius },
        bubbleStyle,
      ]}
      pointerEvents="none"
    >
      {USE_NATIVE_GLASS ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="clear"
          isInteractive
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.bubbleFallback,
            { borderRadius: bubbleRadius },
          ]}
        />
      )}
    </Animated.View>
  );
}

function FrostedPill({
  width,
  height,
  radius,
  children,
}: {
  width: number;
  height: number;
  radius: number;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.pillShell, { width, height, borderRadius: radius }]}>
      <BlurView
        intensity={78}
        tint="systemUltraThinMaterialLight"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[styles.edgeHighlight, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

function FabButton({
  size,
  children,
}: {
  size: number;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const radius = size / 2;

  if (USE_NATIVE_GLASS) {
    return (
      <View
        style={[
          styles.fabClip,
          { width: size, height: size, borderRadius: radius },
        ]}
      >
        <GlassView
          style={{ width: size, height: size, borderRadius: radius }}
          glassEffectStyle="regular"
          isInteractive
          tintColor={theme.colors.secondary}
        >
          <View style={styles.fabInner}>{children}</View>
        </GlassView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fabFallback,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      {children}
    </View>
  );
}

export function LiquidGlassChrome({
  width,
  height,
  pillWidth,
  gap,
  tabWidth,
  bubbleX,
  children,
  fab,
  hasFab = true,
}: LiquidGlassChromeProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const radius = height / 2;

  const pillInner = (
    <>
      <SelectionBubble
        height={height}
        radius={radius}
        tabWidth={tabWidth}
        bubbleX={bubbleX}
      />
      <View style={styles.content}>{children}</View>
    </>
  );

  const pill = USE_NATIVE_GLASS ? (
    <GlassView
      style={{ width: pillWidth, height, borderRadius: radius }}
      glassEffectStyle="regular"
      isInteractive
    >
      {pillInner}
    </GlassView>
  ) : (
    <FrostedPill width={pillWidth} height={height} radius={radius}>
      {pillInner}
    </FrostedPill>
  );

  return (
    <View style={[styles.row, { width, height, gap }]}>
      {pill}
      {hasFab && fab ? <FabButton size={height}>{fab}</FabButton> : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    pillShell: {
      overflow: "hidden",
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255, 255, 255, 0.55)",
    },
    edgeHighlight: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255, 255, 255, 0.42)",
    },
    bubble: {
      position: "absolute",
      top: BUBBLE_INSET_V,
      left: 0,
      overflow: "hidden",
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255, 255, 255, 0.65)",
    },
    bubbleFallback: {
      backgroundColor: "rgba(255, 255, 255, 0.58)",
    },
    content: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
    },
    fabClip: {
      overflow: "hidden",
      flexShrink: 0,
    },
    fabInner: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    fabFallback: {
      backgroundColor: theme.colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
  });
}
