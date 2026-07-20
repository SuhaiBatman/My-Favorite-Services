/**
 * Create / refresh App Store & Play Console reviewer accounts on hosted MFS Supabase.
 *
 * Ensures each account is:
 *   - email-confirmed (no OTP / verification wall)
 *   - has an email identity
 *   - password login returns a live session
 *   - profile + auth metadata include role=user (skips onboarding)
 *
 * Usage:
 *   npm run reviewers:create
 */
import { execFileSync } from 'node:child_process';

const PROJECT_REF = 'oukcgzbjuajoghvnlndx';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

const ACCOUNTS = [
  {
    email: 'apple.review@myfavoriteservices.app',
    password: 'MfsAppleReview2026!',
    first_name: 'Apple',
    last_name: 'Reviewer',
    store: 'Apple App Store',
  },
  {
    email: 'google.review@myfavoriteservices.app',
    password: 'MfsGoogleReview2026!',
    first_name: 'Google',
    last_name: 'Reviewer',
    store: 'Google Play',
  },
];

function getApiKeys() {
  const raw = execFileSync(
    'npx',
    ['supabase', 'projects', 'api-keys', '--project-ref', PROJECT_REF, '-o', 'json'],
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(raw);
  const keys = Array.isArray(parsed) ? parsed : parsed.keys ?? [];
  const serviceKey = keys.find((k) => k.id === 'service_role')?.api_key;
  const anonKey = keys.find((k) => k.id === 'anon')?.api_key;
  if (!serviceKey || !anonKey) {
    throw new Error('Could not resolve service_role / anon API keys from supabase CLI');
  }
  return { serviceKey, anonKey };
}

async function adminFetch(serviceKey, path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text}`);
  }
  return body;
}

async function findUserByEmail(serviceKey, email) {
  const data = await adminFetch(serviceKey, '/admin/users?page=1&per_page=200');
  const users = data.users || data;
  return (Array.isArray(users) ? users : []).find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
}

function reviewerMetadata(account) {
  return {
    first_name: account.first_name,
    last_name: account.last_name,
    role: 'user',
    roles: ['user'],
    email_verified: true,
    // Paid Basic plan for App Store / Play review
    plan: 'basic',
    subscription_status: 'active',
    has_paid_access: true,
  };
}

async function upsertAuthUser(serviceKey, account) {
  const meta = reviewerMetadata(account);
  const existing = await findUserByEmail(serviceKey, account.email);

  if (existing) {
    const user = await adminFetch(serviceKey, `/admin/users/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        password: account.password,
        email_confirm: true,
        ban_duration: 'none',
        user_metadata: meta,
      }),
    });
    return { id: user.id, action: 'updated' };
  }

  const user = await adminFetch(serviceKey, '/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: meta,
    }),
  });
  return { id: user.id, action: 'created' };
}

/** Force-confirm again after create/update (idempotent). */
async function forceConfirmEmail(serviceKey, userId, account) {
  return adminFetch(serviceKey, `/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({
      email_confirm: true,
      user_metadata: reviewerMetadata(account),
    }),
  });
}

async function upsertProfile(serviceKey, userId, account) {
  const row = {
    id: userId,
    email: account.email,
    first_name: account.first_name,
    last_name: account.last_name,
    role: 'user',
    roles: ['user'],
    interests: 'beauty,fitness,wellness,home',
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`profile upsert failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Grant RevenueCat promotional "MFS Basic" via API v2.
 * Requires REVENUECAT_SECRET_API_KEY (v2 secret). Optional REVENUECAT_PROJECT_ID.
 * App also treats reviewer accounts as paid via auth metadata / allowlist.
 */
async function grantRevenueCatBasic(userId) {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY?.trim();
  if (!apiKey) {
    return { granted: false, skipped: true, reason: 'REVENUECAT_SECRET_API_KEY not set' };
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  async function rc2(method, path, body) {
    const res = await fetch(`https://api.revenuecat.com/v2${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  }

  let projectId = process.env.REVENUECAT_PROJECT_ID?.trim();
  if (!projectId) {
    const projects = await rc2('GET', '/projects');
    projectId = projects.json?.items?.[0]?.id;
    if (!projectId) {
      return { granted: false, skipped: false, status: projects.status, body: projects.json };
    }
  }

  // Resolve entitlement by lookup_key "MFS Basic" (create if missing)
  const ents = await rc2('GET', `/projects/${projectId}/entitlements`);
  let entitlement = (ents.json?.items || []).find(
    (e) => e.lookup_key === 'MFS Basic' || e.display_name === 'MFS Basic'
  );
  if (!entitlement) {
    const created = await rc2('POST', `/projects/${projectId}/entitlements`, {
      lookup_key: 'MFS Basic',
      display_name: 'MFS Basic',
    });
    if (!created.ok) {
      return { granted: false, skipped: false, status: created.status, body: created.json };
    }
    entitlement = created.json;
  }

  // Ensure customer exists
  const customerPath = `/projects/${projectId}/customers/${encodeURIComponent(userId)}`;
  const existing = await rc2('GET', customerPath);
  if (existing.status === 404) {
    await rc2('POST', `/projects/${projectId}/customers`, { id: userId });
  }

  // Far-future expiry ≈ lifetime for store review accounts
  const expiresAt = Date.UTC(2099, 0, 1);
  const grant = await rc2('POST', `${customerPath}/actions/grant_entitlement`, {
    entitlement_id: entitlement.id,
    expires_at: expiresAt,
  });
  if (!grant.ok && grant.status !== 409) {
    return { granted: false, skipped: false, status: grant.status, body: grant.json };
  }

  const active = await rc2('GET', `${customerPath}/active_entitlements`);
  const hasBasic = (active.json?.items || []).some(
    (item) => item.entitlement_id === entitlement.id
  );
  return {
    granted: hasBasic,
    skipped: false,
    projectId,
    entitlementId: entitlement.id,
    expires: expiresAt,
  };
}

/**
 * End-to-end auth check as the app would see it:
 * password grant → confirmed session → readable onboarded profile.
 */
async function assertAuthenticated(anonKey, account) {
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`login failed for ${account.email}: ${JSON.stringify(loginBody)}`);
  }

  const user = loginBody.user;
  const accessToken = loginBody.access_token;
  if (!accessToken) throw new Error(`no access_token for ${account.email}`);
  if (!user?.email_confirmed_at && !user?.confirmed_at) {
    throw new Error(`${account.email} session is not email-confirmed`);
  }
  if (user?.user_metadata?.role !== 'user') {
    throw new Error(`${account.email} missing role=user in session metadata`);
  }

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=id,role,roles,first_name,last_name`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const profiles = await profileRes.json();
  if (!profileRes.ok) {
    throw new Error(`profile read failed for ${account.email}: ${JSON.stringify(profiles)}`);
  }
  const profile = profiles[0];
  if (!profile || profile.role !== 'user') {
    throw new Error(`${account.email} profile not onboarded: ${JSON.stringify(profile)}`);
  }

  return {
    userId: user.id,
    emailConfirmed: true,
    hasSession: true,
    role: profile.role,
    roles: profile.roles,
    user,
  };
}

async function main() {
  const { serviceKey, anonKey } = getApiKeys();
  const results = [];

  for (const account of ACCOUNTS) {
    const { id, action } = await upsertAuthUser(serviceKey, account);
    await forceConfirmEmail(serviceKey, id, account);
    await upsertProfile(serviceKey, id, account);

    const detail = await adminFetch(serviceKey, `/admin/users/${id}`);
    if (!detail.email_confirmed_at) {
      throw new Error(`admin still shows ${account.email} unconfirmed`);
    }
    const hasEmailIdentity = (detail.identities || []).some((i) => i.provider === 'email');
    if (!hasEmailIdentity) {
      throw new Error(`${account.email} missing email identity`);
    }

    const auth = await assertAuthenticated(anonKey, account);
    if (auth.user?.user_metadata?.plan !== 'basic') {
      throw new Error(`${account.email} missing plan=basic in session metadata`);
    }
    if (auth.user?.user_metadata?.has_paid_access !== true) {
      throw new Error(`${account.email} missing has_paid_access in session metadata`);
    }

    const rc = await grantRevenueCatBasic(id);
    results.push({
      store: account.store,
      email: account.email,
      password: account.password,
      userId: id,
      action,
      authenticated: auth,
      paidPlan: true,
      revenueCat: rc,
    });
  }

  console.log('\nMFS reviewer accounts — authenticated, onboarded, paid Basic:\n');
  for (const r of results) {
    console.log(`  ${r.store}`);
    console.log(`    Email:         ${r.email}`);
    console.log(`    Password:      ${r.password}`);
    console.log(`    User ID:       ${r.userId}`);
    console.log(`    Email confirm: yes`);
    console.log(`    Session:       yes`);
    console.log(`    Onboarded:     role=${r.authenticated.role}`);
    console.log(`    Paid plan:     basic (metadata)`);
    if (r.revenueCat.skipped) {
      console.log(`    RevenueCat:    skipped (${r.revenueCat.reason})`);
    } else if (r.revenueCat.granted) {
      console.log(`    RevenueCat:    MFS Basic granted (expires 2099)`);
    } else {
      console.log(`    RevenueCat:    FAILED ${r.revenueCat.status}`);
    }
    console.log(`    Status:        ${r.action}\n`);
  }
  console.log(
    'Reviewers: use Email + Password sign-in (not Apple/Google social buttons).'
  );
  if (results.some((r) => r.revenueCat.skipped)) {
    console.log(
      '\nTip: export REVENUECAT_SECRET_API_KEY=sk_... then re-run to also grant RC promotional entitlements.'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
