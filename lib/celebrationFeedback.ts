import * as Haptics from 'expo-haptics';

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Success haptic rhythm for completing a meaningful flow. */
export async function playCelebrationHaptics() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await delay(120);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await delay(180);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Haptics unavailable on this device — ignore.
  }
}
