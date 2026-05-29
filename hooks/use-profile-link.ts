import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { parseProfileIdFromQr } from '../lib/qr';

/** Routes incoming deep links (e.g. from QR scan outside the in-app camera) to the profile screen. */
export function useProfileDeepLinkListener() {
  const router = useRouter();

  useEffect(() => {
    const navigateFromUrl = (url: string) => {
      const profileId = parseProfileIdFromQr(url);
      if (profileId) {
        router.push(`/profile/${profileId}`);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) navigateFromUrl(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => navigateFromUrl(url));
    return () => sub.remove();
  }, [router]);
}
