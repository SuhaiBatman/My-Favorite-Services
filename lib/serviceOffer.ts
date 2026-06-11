export type ServiceOffer = {
  name: string;
  durationMinutes: number;
  priceCents: number;
};

export function formatServiceDuration(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours} hr${hours === 1 ? '' : 's'} ${remainder} min`;
}

export function formatServicePrice(cents: number): string {
  if (cents < 0) return '';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function serviceOffersToProfileString(services: ServiceOffer[]): string {
  return services.map((service) => service.name.trim()).filter(Boolean).join(', ');
}

export function normalizeServiceOffers(value: unknown): ServiceOffer[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        const name = entry.trim();
        return name ? { name, durationMinutes: 0, priceCents: 0 } : null;
      }
      if (!entry || typeof entry !== 'object' || typeof (entry as ServiceOffer).name !== 'string') {
        return null;
      }
      const offer = entry as ServiceOffer;
      const name = offer.name.trim();
      if (!name) return null;
      return {
        name,
        durationMinutes: Number(offer.durationMinutes) || 0,
        priceCents: Number(offer.priceCents) || 0,
      };
    })
    .filter((entry): entry is ServiceOffer => Boolean(entry));
}

export function parseDollarInput(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, '');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function parseDurationInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function isCompleteServiceOffer(service: ServiceOffer): boolean {
  return Boolean(service.name.trim()) && service.durationMinutes > 0 && service.priceCents >= 0;
}
