import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import type { AppTheme } from "../constants/theme";
import { useAppTheme } from "../contexts/ThemeContext";
import { useThemedStyles } from "../hooks/use-themed-styles";
import { colorWithOpacity } from "../lib/colorWithOpacity";
import {
  LiquidGlassContainer,
  LiquidGlassSurface,
  canUseNativeGlassEffect,
  glassShellStyle,
} from "./LiquidGlassSurface";

const IS_ANDROID = Platform.OS === "android";

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
  theme,
  isDark,
  useNativeGlass,
}: {
  height: number;
  radius: number;
  tabWidth: number;
  bubbleX: SharedValue<number>;
  theme: AppTheme;
  isDark: boolean;
  useNativeGlass: boolean;
}) {
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
        {
          height: bubbleHeight,
          borderRadius: bubbleRadius,
          borderColor: colorWithOpacity(theme.colors.textPrimary, 0.12),
        },
        bubbleStyle,
      ]}
      pointerEvents="none"
    >
      <LiquidGlassSurface
        theme={theme}
        isDark={isDark}
        style={StyleSheet.absoluteFill}
        borderRadius={bubbleRadius}
        interactive={useNativeGlass}
        tintOpacity={isDark ? 0.08 : 0.06}
      />
    </Animated.View>
  );
}

function FabButton({
  size,
  theme,
  isDark,
  useNativeGlass,
  children,
}: {
  size: number;
  theme: AppTheme;
  isDark: boolean;
  useNativeGlass: boolean;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const radius = size / 2;

  return (
    <View
      style={[
        styles.fabClip,
        glassShellStyle(theme),
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <LiquidGlassSurface
        theme={theme}
        isDark={isDark}
        style={StyleSheet.absoluteFill}
        borderRadius={radius}
        interactive={useNativeGlass}
      />
      <View style={styles.fabInner}>{children}</View>
    </View>
  );
}

function SolidPill({
  width,
  height,
  radius,
  theme,
  children,
}: {
  width: number;
  height: number;
  radius: number;
  theme: AppTheme;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[
        styles.pillShell,
        glassShellStyle(theme),
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colorWithOpacity(theme.colors.surface, 0.96),
        },
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
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const useNativeGlass = useMemo(canUseNativeGlassEffect, []);

  const radius = height / 2;

  const pillInner = (
    <>
      <SelectionBubble
        height={height}
        radius={radius}
        tabWidth={tabWidth}
        bubbleX={bubbleX}
        theme={theme}
        isDark={isDark}
        useNativeGlass={useNativeGlass}
      />
      <View style={styles.content}>{children}</View>
    </>
  );

  const pill = useNativeGlass ? (
    <View
      style={[
        styles.pillShell,
        glassShellStyle(theme),
        { width: pillWidth, height, borderRadius: radius },
      ]}
    >
      <LiquidGlassSurface
        theme={theme}
        isDark={isDark}
        style={StyleSheet.absoluteFill}
        borderRadius={radius}
        interactive={useNativeGlass}
      />
      {pillInner}
    </View>
  ) : IS_ANDROID ? (
    <SolidPill width={pillWidth} height={height} radius={radius} theme={theme}>
      {pillInner}
    </SolidPill>
  ) : (
    <View
      style={[
        styles.pillShell,
        glassShellStyle(theme),
        { width: pillWidth, height, borderRadius: radius },
      ]}
    >
      <LiquidGlassSurface
        theme={theme}
        isDark={isDark}
        style={StyleSheet.absoluteFill}
        borderRadius={radius}
        interactive={false}
      />
      {pillInner}
    </View>
  );

  return (
    <View style={[styles.row, { width, height, gap }]}>
      {useNativeGlass ? (
        <LiquidGlassContainer style={styles.glassGroup} spacing={gap} enabled>
          {pill}
          {hasFab && fab ? (
            <FabButton
              size={height}
              theme={theme}
              isDark={isDark}
              useNativeGlass={useNativeGlass}
            >
              {fab}
            </FabButton>
          ) : null}
        </LiquidGlassContainer>
      ) : (
        <>
          {pill}
          {hasFab && fab ? (
            <FabButton
              size={height}
              theme={theme}
              isDark={isDark}
              useNativeGlass={useNativeGlass}
            >
              {fab}
            </FabButton>
          ) : null}
        </>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    glassGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    pillShell: {
      overflow: "hidden",
      borderCurve: "continuous",
    },
    bubble: {
      position: "absolute",
      top: BUBBLE_INSET_V,
      left: 0,
      overflow: "hidden",
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
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
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
