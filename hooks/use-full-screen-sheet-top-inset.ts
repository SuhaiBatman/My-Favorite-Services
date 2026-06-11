import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Top inset for full-screen Modal / pageSheet content.
 * SafeAreaView often reports 0 for the top edge inside RN Modal on Android.
 */
export function useFullScreenSheetTopInset(): number {
  const insets = useSafeAreaInsets();
  const statusBarInset =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  return Math.max(insets.top, statusBarInset);
}
