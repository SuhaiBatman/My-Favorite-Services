export function formatPhoneNumber(text: string): string {
  const cleaned = text.replace(/\D/g, '').slice(0, 10);
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 3) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3)}`;
  return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
}

export function phoneDigits(text: string): string {
  return text.replace(/\D/g, '').slice(0, 10);
}

export function toE164US(digits: string): string {
  if (digits.length !== 10) {
    throw new Error('Enter a valid 10-digit phone number.');
  }
  return `+1${digits}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
