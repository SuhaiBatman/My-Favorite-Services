import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect';
import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import type { AppTheme } from '../constants/theme';
import { colorWithOpacity } from '../lib/colorWithOpacity';

const NATIVE_GLASS_AVAILABLE: boolean = (() => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

export const canUseNativeGlassEffect = (): boolean => NATIVE_GLASS_AVAILABLE;

type LiquidGlassSurfaceProps = {
  theme: AppTheme;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  tintOpacity?: number;
  interactive?: boolean;
  blurIntensity?: number;
  children?: React.ReactNode;
};

export const LiquidGlassSurface: React.FC<LiquidGlassSurfaceProps> = ({
  theme,
  isDark,
  style,
  borderRadius,
  tintOpacity = 0.03,
  interactive = false,
  blurIntensity = 86,
  children,
}) => {
  const colorScheme = isDark ? 'dark' : 'light';
  const roundedFillStyle = [
    StyleSheet.absoluteFill,
    borderRadius == null ? null : { borderRadius },
  ];
  const initialMaterialColor = colorWithOpacity(
    theme.colors.background,
    isDark ? 0.28 : 0.22,
  );

  const fill = NATIVE_GLASS_AVAILABLE ? (
    <>
      <View
        style={[roundedFillStyle, { backgroundColor: initialMaterialColor }]}
        pointerEvents="none"
      />
      <GlassView
        glassEffectStyle={{ style: 'clear', animate: false }}
        colorScheme={colorScheme}
        isInteractive={interactive}
        tintColor={colorWithOpacity(theme.colors.background, 0.05)}
        style={roundedFillStyle}
        pointerEvents="none"
      />
    </>
  ) : Platform.OS === 'ios' ? (
    <BlurView
      intensity={blurIntensity}
      tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      style={roundedFillStyle}
      pointerEvents="none"
    />
  ) : (
    <View
      style={[
        roundedFillStyle,
        { backgroundColor: colorWithOpacity(theme.colors.background, 0.72) },
      ]}
      pointerEvents="none"
    />
  );

  return (
    <View
      style={[
        borderRadius == null ? null : { borderRadius, overflow: 'hidden' },
        style,
      ]}
    >
      {fill}
      <View
        pointerEvents="none"
        style={[
          roundedFillStyle,
          { backgroundColor: colorWithOpacity(theme.colors.background, tintOpacity) },
        ]}
      />
      {children}
    </View>
  );
};

type LiquidGlassContainerProps = {
  style?: StyleProp<ViewStyle>;
  spacing?: number;
  enabled?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  children?: React.ReactNode;
};

export const LiquidGlassContainer: React.FC<LiquidGlassContainerProps> = ({
  style,
  spacing = 0,
  enabled = true,
  pointerEvents,
  children,
}) => {
  if (NATIVE_GLASS_AVAILABLE && enabled) {
    return (
      <GlassContainer style={style as any} spacing={spacing} pointerEvents={pointerEvents}>
        {children}
      </GlassContainer>
    );
  }

  return (
    <View style={style} pointerEvents={pointerEvents}>
      {children}
    </View>
  );
};

export function glassShellStyle(theme: AppTheme) {
  return {
    borderWidth: 1,
    borderColor: colorWithOpacity(theme.colors.textPrimary, 0.16),
    backgroundColor: colorWithOpacity(theme.colors.background, 0.04),
    shadowColor: colorWithOpacity(theme.colors.textPrimary, 0.9),
    shadowOffset: { width: 0, height: 10 } as const,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
  };
}
