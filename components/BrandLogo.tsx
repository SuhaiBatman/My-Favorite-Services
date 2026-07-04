import { Image } from 'expo-image';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

const LOGO_LIGHT = require('../assets/images/splash-icon.png');
const LOGO_DARK = require('../assets/images/splash-icon-dark.png');

type BrandLogoProps = {
  size?: number;
  style?: ViewStyle;
};

export function BrandLogo({ size = 160, style }: BrandLogoProps) {
  const { isDark } = useAppTheme();

  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={isDark ? LOGO_DARK : LOGO_LIGHT}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel="My Favorite Services logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
