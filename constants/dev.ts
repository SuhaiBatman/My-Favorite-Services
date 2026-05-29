export const DEV_USER_IDS = [
  'e462085d-9ef9-40b0-a577-dc5b485d180f',
  /** Local seed consumer — alex@demo.local / password123 */
  'a0000000-0000-4000-8000-000000000001',
];

/** Local `supabase/seed.sql` demo login */
export const SEED_DEMO = {
  email: 'alex@demo.local',
  password: 'password123',
} as const;

export const APP_ROUTES = [
  { label: 'Home (Tabs)', path: '/(tabs)' },
  { label: 'Favorites', path: '/(tabs)/favorites' },
  { label: 'Messages', path: '/(tabs)/messages' },
  { label: 'Schedule', path: '/(tabs)/schedule' },
  { label: 'Login', path: '/(auth)/login' },
  { label: 'Onboarding', path: '/(auth)/onboarding' },
  { label: 'Modal Screen', path: '/modal' },
  { label: 'Chat Demo', path: '/chat/1' },
];
