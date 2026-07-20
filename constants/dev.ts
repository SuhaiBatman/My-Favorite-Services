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

/**
 * Hosted store-reviewer accounts (passwords in scripts/create-reviewer-accounts.mjs).
 * Recreate/refresh with: `npm run reviewers:create`
 * These accounts are treated as paid (Basic) for App Review / Play review.
 */
export const STORE_REVIEWER_EMAILS = {
  apple: 'apple.review@myfavoriteservices.app',
  google: 'google.review@myfavoriteservices.app',
} as const;

/** Production user IDs for the store reviewer accounts. */
export const STORE_REVIEWER_USER_IDS = [
  '3b513289-48c8-4da6-a89b-4d98938bafac', // apple.review@...
  '1acd5b96-1e82-4d99-9a48-d0aac410ad26', // google.review@...
] as const;

export function isStoreReviewerAccount(options: {
  email?: string | null;
  userId?: string | null;
}): boolean {
  const email = options.email?.trim().toLowerCase();
  if (email && Object.values(STORE_REVIEWER_EMAILS).some((e) => e.toLowerCase() === email)) {
    return true;
  }
  const userId = options.userId?.trim();
  if (userId && STORE_REVIEWER_USER_IDS.includes(userId as (typeof STORE_REVIEWER_USER_IDS)[number])) {
    return true;
  }
  return false;
}

/** Auth metadata / profile flag that marks an account as on the Basic paid plan. */
export function hasPaidPlanMetadata(meta?: Record<string, unknown> | null): boolean {
  if (!meta) return false;
  const plan = String(meta.plan ?? '').toLowerCase();
  const status = String(meta.subscription_status ?? '').toLowerCase();
  if (plan === 'basic' || plan === 'pro' || plan === 'paid') return true;
  if (status === 'active' || status === 'trialing') return true;
  return meta.has_paid_access === true;
}

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
