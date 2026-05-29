/**
 * Defines which appointment details each service type needs.
 * Templates map to concrete fields (date, times, addresses, etc.).
 */

export type BookingFieldKey =
  | 'appointmentDate'
  | 'startTime'
  | 'endTime'
  | 'pickupTime'
  | 'dropoffTime'
  | 'startDestination'
  | 'endDestination'
  | 'location'
  | 'notes';

export type BookingFieldType = 'date' | 'time' | 'text' | 'address';

export type ServiceBookingTemplate =
  | 'simple_appointment'
  | 'ride'
  | 'windowed_appointment'
  | 'on_site_visit';

export type BookingFieldDef = {
  key: BookingFieldKey;
  label: string;
  type: BookingFieldType;
  required: boolean;
  placeholder?: string;
};

export type BookingDetails = Partial<Record<BookingFieldKey, string>>;

export const BOOKING_TEMPLATES: Record<ServiceBookingTemplate, BookingFieldDef[]> = {
  /** Haircuts, consultations, massages — date + single start time */
  simple_appointment: [
    { key: 'appointmentDate', label: 'Date', type: 'date', required: true },
    { key: 'startTime', label: 'Start time', type: 'time', required: true },
  ],
  /** Car rides — pickup/drop-off locations and times */
  ride: [
    {
      key: 'startDestination',
      label: 'Pickup location',
      type: 'address',
      required: true,
      placeholder: 'Where should we pick you up?',
    },
    {
      key: 'endDestination',
      label: 'Drop-off location',
      type: 'address',
      required: true,
      placeholder: 'Where are you going?',
    },
    { key: 'appointmentDate', label: 'Pickup date', type: 'date', required: true },
    { key: 'pickupTime', label: 'Pickup time', type: 'time', required: true },
    { key: 'dropoffTime', label: 'Drop-off time', type: 'time', required: false },
  ],
  /** Services that need an explicit end time (e.g. venue rental) */
  windowed_appointment: [
    { key: 'appointmentDate', label: 'Date', type: 'date', required: true },
    { key: 'startTime', label: 'Start time', type: 'time', required: true },
    { key: 'endTime', label: 'End time', type: 'time', required: true },
  ],
  /** Home visits — service address plus schedule */
  on_site_visit: [
    {
      key: 'location',
      label: 'Service address',
      type: 'address',
      required: true,
      placeholder: 'Street address or location notes',
    },
    { key: 'appointmentDate', label: 'Date', type: 'date', required: true },
    { key: 'startTime', label: 'Start time', type: 'time', required: true },
  ],
};

export const SERVICE_BOOKING_TEMPLATE_LABELS: Record<ServiceBookingTemplate, string> = {
  simple_appointment: 'Appointment',
  ride: 'Ride',
  windowed_appointment: 'Time window',
  on_site_visit: 'On-site visit',
};

export function getFieldsForTemplate(template: ServiceBookingTemplate): BookingFieldDef[] {
  return BOOKING_TEMPLATES[template];
}

export function getDateFields(fields: BookingFieldDef[]): BookingFieldDef[] {
  return fields.filter((f) => f.type === 'date');
}

export function getTimeFields(fields: BookingFieldDef[]): BookingFieldDef[] {
  return fields.filter((f) => f.type === 'time');
}

export function getInputFields(fields: BookingFieldDef[]): BookingFieldDef[] {
  return fields.filter((f) => f.type === 'text' || f.type === 'address');
}

export function hasDateField(fields: BookingFieldDef[]): boolean {
  return fields.some((f) => f.type === 'date');
}

export function getDetailValue(
  key: BookingFieldKey,
  details: BookingDetails,
  selectedDate: Date | null,
  formatDate: (date: Date) => string
): string | null {
  if (key === 'appointmentDate') {
    return selectedDate ? formatDate(selectedDate) : null;
  }
  const value = details[key];
  return value?.trim() ? value.trim() : null;
}

export function isBookingComplete(
  fields: BookingFieldDef[],
  details: BookingDetails,
  selectedDate: Date | null
): boolean {
  return fields
    .filter((f) => f.required)
    .every((field) => {
      if (field.type === 'date') return selectedDate !== null;
      return Boolean(details[field.key]?.trim());
    });
}

export function formatDateForSummary(date: Date, monthNames: string[]): string {
  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Brick-and-mortar: customer visits the provider's fixed location. */
export function isBrickAndMortarTemplate(template: ServiceBookingTemplate): boolean {
  return template === 'simple_appointment' || template === 'windowed_appointment';
}

export function needsUserProvidedAddresses(template: ServiceBookingTemplate): boolean {
  return template === 'ride' || template === 'on_site_visit';
}

export function buildAppointmentLocation(
  template: ServiceBookingTemplate,
  details: BookingDetails,
  providerLocation: string | null | undefined
): string | null {
  switch (template) {
    case 'simple_appointment':
    case 'windowed_appointment':
      return providerLocation?.trim() || null;
    case 'on_site_visit':
      return details.location?.trim() || null;
    case 'ride': {
      const pickup = details.startDestination?.trim();
      const dropoff = details.endDestination?.trim();
      if (!pickup && !dropoff) return null;
      const parts: string[] = [];
      if (pickup) parts.push(`Pickup: ${pickup}`);
      if (dropoff) parts.push(`Drop-off: ${dropoff}`);
      return parts.join(' · ');
    }
    default:
      return null;
  }
}

/** Suggest a template from a free-text service name (onboarding / legacy data). */
export function inferTemplateFromServiceName(name: string): ServiceBookingTemplate {
  const lower = name.toLowerCase();
  if (
    /\b(ride|taxi|uber|lyft|transport|shuttle|airport transfer|car service)\b/.test(lower)
  ) {
    return 'ride';
  }
  if (/\b(clean|plumb|repair|install|inspect|hvac|lawn|pest)\b/.test(lower)) {
    return 'on_site_visit';
  }
  if (/\b(rent|rental|event space|venue)\b/.test(lower)) {
    return 'windowed_appointment';
  }
  return 'simple_appointment';
}
