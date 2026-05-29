import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isValidEmail, phoneDigits, toE164US } from './phone';

export type ConfirmedContact = {
  email: string;
  phone: string;
  authPhoneE164: string | null;
};

export function userHasPasswordIdentity(user: User | null): boolean {
  return Boolean(user?.identities?.some((identity) => identity.provider === 'email'));
}

export async function fetchConfirmedContact(user: User | null): Promise<ConfirmedContact> {
  const meta = user?.user_metadata ?? {};
  let email = user?.email ?? (typeof meta.email === 'string' ? meta.email : '');
  let phone = typeof meta.phone === 'string' ? meta.phone : '';

  if (user?.id) {
    const { data } = await supabase
      .from('profiles')
      .select('email, phone')
      .eq('id', user.id)
      .maybeSingle();

    if (data?.email) email = data.email;
    if (data?.phone) phone = data.phone;
  }

  return {
    email,
    phone,
    authPhoneE164: user?.phone ?? null,
  };
}

export async function verifyPasswordReauth(email: string, password: string): Promise<void> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    throw new Error('Enter your current password to continue.');
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (error) {
    throw new Error('Incorrect password. Your email and phone were not changed.');
  }
}

export async function sendReauthenticationOtp(): Promise<void> {
  const { error } = await supabase.auth.reauthenticate();
  if (error) {
    throw new Error(error.message);
  }
}

export async function verifyReauthenticationOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'reauthentication',
  });

  if (error) {
    throw new Error('Verification failed. Your email and phone were not changed.');
  }
}

/** Sends a verification email to the new address. Auth email is not updated until OTP succeeds. */
export async function requestEmailChange(newEmail: string): Promise<void> {
  const trimmed = newEmail.trim();
  if (!isValidEmail(trimmed)) {
    throw new Error('Enter a valid email address.');
  }

  const { error } = await supabase.auth.updateUser({ email: trimmed });
  if (error) {
    throw new Error(error.message);
  }
}

export async function resendEmailVerification(newEmail: string): Promise<void> {
  await requestEmailChange(newEmail);
}

/**
 * Verifies the new email OTP, then syncs auth metadata + profile.
 * On failure the pending auth change is reverted to the confirmed email.
 */
export async function confirmEmailChange(
  newEmail: string,
  token: string,
  confirmedEmail: string
): Promise<string> {
  const trimmedEmail = newEmail.trim();
  const { error } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: token.trim(),
    type: 'email_change',
  });

  if (error) {
    await cancelPendingEmailChange(confirmedEmail);
    throw new Error('Email verification failed. Your email was not changed.');
  }

  await syncProfileEmail(trimmedEmail);
  return trimmedEmail;
}

/** Sends an SMS verification code to the new number. Profile phone is not updated until OTP succeeds. */
export async function requestPhoneChange(formattedPhone: string): Promise<string> {
  const digits = phoneDigits(formattedPhone);
  const e164 = toE164US(digits);

  const { error } = await supabase.auth.updateUser({ phone: e164 });
  if (error) {
    throw new Error(
      error.message.includes('phone') || error.message.includes('SMS')
        ? 'SMS verification is not available. Your phone number was not changed.'
        : error.message
    );
  }

  return e164;
}

export async function resendPhoneVerification(formattedPhone: string): Promise<string> {
  return requestPhoneChange(formattedPhone);
}

/**
 * Verifies the SMS OTP, then syncs auth metadata + profile.
 * On failure the pending auth change is reverted to the confirmed phone.
 */
export async function confirmPhoneChange(
  e164Phone: string,
  token: string,
  formattedPhone: string,
  confirmedAuthPhoneE164: string | null
): Promise<string> {
  const { error } = await supabase.auth.verifyOtp({
    phone: e164Phone,
    token: token.trim(),
    type: 'phone_change',
  });

  if (error) {
    await cancelPendingPhoneChange(confirmedAuthPhoneE164);
    throw new Error('Phone verification failed. Your phone number was not changed.');
  }

  await syncProfilePhone(formattedPhone);
  return formattedPhone;
}

/** Reverts a pending email change back to the last confirmed address. */
export async function cancelPendingEmailChange(confirmedEmail: string): Promise<void> {
  const trimmed = confirmedEmail.trim();
  if (!trimmed) return;

  const { error } = await supabase.auth.updateUser({ email: trimmed });
  if (error) {
    console.warn('cancelPendingEmailChange:', error.message);
  }

  await supabase.auth.refreshSession();
}

/** Reverts a pending phone change back to the last confirmed auth phone (if any). */
export async function cancelPendingPhoneChange(confirmedAuthPhoneE164: string | null): Promise<void> {
  if (confirmedAuthPhoneE164) {
    const { error } = await supabase.auth.updateUser({ phone: confirmedAuthPhoneE164 });
    if (error) {
      console.warn('cancelPendingPhoneChange:', error.message);
    }
  }

  await supabase.auth.refreshSession();
}

export async function cancelPendingCredentialChange(
  type: 'email' | 'phone',
  confirmed: ConfirmedContact
): Promise<void> {
  if (type === 'email') {
    await cancelPendingEmailChange(confirmed.email);
    return;
  }
  await cancelPendingPhoneChange(confirmed.authPhoneE164);
}

async function syncProfileEmail(email: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.auth.updateUser({ data: { email } });
  await supabase.from('profiles').update({ email, updated_at: new Date().toISOString() }).eq('id', user.id);
}

async function syncProfilePhone(phone: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.auth.updateUser({ data: { phone } });
  await supabase.from('profiles').update({ phone, updated_at: new Date().toISOString() }).eq('id', user.id);
}
