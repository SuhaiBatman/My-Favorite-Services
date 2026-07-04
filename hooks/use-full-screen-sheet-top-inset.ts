import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const IOS_PAGE_SHEET_TOP_PADDING = 16;

/**
 * Top padding for Modal content.
 *
 * iOS pageSheet modals already sit below the status bar — do not add the full
 * safe-area inset or headers end up with a large empty gap.
 *
 * Pass `{ fullScreen: true }` for Android fullscreen modals or iOS fullScreenCover.
 */
export function useFullScreenSheetTopInset(options?: { fullScreen?: boolean }): number {
  const insets = useSafeAreaInsets();
  const statusBarInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  if (!options?.fullScreen && Platform.OS === 'ios') {
    return IOS_PAGE_SHEET_TOP_PADDING;
  }

  return Math.max(insets.top, statusBarInset);
}
