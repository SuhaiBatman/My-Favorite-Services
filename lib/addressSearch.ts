/**
 * Place & address autocomplete (airports, landmarks, streets).
 *
 * Best quality (Google/Apple-like POIs e.g. "DFW airport"):
 *   Mapbox Search Box — free tier, 100k sessions/month, $0 within limit.
 *   https://account.mapbox.com/ → create token (public `pk.` token)
 *
 * Alternative free tier:
 *   LocationIQ — 5,000 requests/day free
 *   https://locationiq.com/
 *
 * Fallback (streets only, weak on airports):
 *   Photon / OpenStreetMap — no key
 */

export type AddressSearchProvider = 'mapbox' | 'locationiq' | 'photon';

export type AddressSuggestion = {
  id: string;
  label: string;
  formatted: string;
  provider: AddressSearchProvider;
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
const LOCATIONIQ_KEY = process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY?.trim();
const PHOTON_USER_AGENT = 'MyFavoriteServices/1.0';

export function getAddressSearchProvider(): AddressSearchProvider {
  if (MAPBOX_TOKEN) return 'mapbox';
  if (LOCATIONIQ_KEY) return 'locationiq';
  return 'photon';
}

/** True when a high-quality provider is configured (Mapbox or LocationIQ) */
export function isHighQualitySearchEnabled(): boolean {
  return Boolean(MAPBOX_TOKEN || LOCATIONIQ_KEY);
}

export function isAddressSearchConfigured(): boolean {
  return true;
}

export function addressSearchSetupMessage(): string {
  if (MAPBOX_TOKEN) return '';
  return (
    'For airport and place search like Google Maps, add a free Mapbox token to .env.local:\n' +
    'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token\n' +
    '(Free at mapbox.com — 100,000 searches/month, no charge within that limit.)'
  );
}

export function addressSearchAttribution(provider: AddressSearchProvider): string {
  switch (provider) {
    case 'mapbox':
      return 'Powered by Mapbox · free tier';
    case 'locationiq':
      return 'Powered by LocationIQ · free tier';
    default:
      return 'Basic search only — add Mapbox token for airports & places';
  }
}

// --- Mapbox Search Box (POI + address, best quality) ---

type MapboxSuggestItem = {
  mapbox_id: string;
  name?: string;
  name_preferred?: string;
  full_address?: string;
  place_formatted?: string;
  address?: string;
};

async function searchMapbox(query: string, sessionToken: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://api.mapbox.com/search/searchbox/v1/suggest');
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', MAPBOX_TOKEN!);
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('limit', '8');
  url.searchParams.set('language', 'en');
  url.searchParams.set('country', 'us');

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (__DEV__) console.warn('[addressSearch] Mapbox suggest HTTP', res.status);
    return [];
  }

  const json = (await res.json()) as { suggestions?: MapboxSuggestItem[] };

  return (json.suggestions ?? []).map((s) => {
    const title = s.name_preferred || s.name || '';
    const subtitle = s.place_formatted || s.address || '';
    const label =
      title && subtitle && !subtitle.startsWith(title)
        ? `${title}, ${subtitle}`
        : s.full_address || title || subtitle;

    return {
      id: s.mapbox_id,
      label,
      formatted: s.full_address || label,
      provider: 'mapbox' as const,
    };
  });
}

async function resolveMapbox(mapboxId: string, sessionToken: string): Promise<string | null> {
  const url = new URL(
    `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}`
  );
  url.searchParams.set('access_token', MAPBOX_TOKEN!);
  url.searchParams.set('session_token', sessionToken);

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const json = (await res.json()) as {
    features?: Array<{
      properties?: {
        full_address?: string;
        name?: string;
        place_formatted?: string;
      };
    }>;
  };

  const props = json.features?.[0]?.properties;
  return (
    props?.full_address?.trim() ||
    props?.place_formatted?.trim() ||
    props?.name?.trim() ||
    null
  );
}

// --- LocationIQ (free tier autocomplete) ---

type LocationIqItem = {
  place_id: string | number;
  display_name: string;
};

async function searchLocationIq(query: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://us1.locationiq.com/v1/autocomplete');
  url.searchParams.set('key', LOCATIONIQ_KEY!);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '8');
  url.searchParams.set('dedupe', '1');
  url.searchParams.set('countrycodes', 'us');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const json = (await res.json()) as LocationIqItem[] | { error?: string };
  if (!Array.isArray(json)) return [];

  return json.map((item) => ({
    id: String(item.place_id),
    label: item.display_name,
    formatted: item.display_name,
    provider: 'locationiq' as const,
  }));
}

// --- Photon fallback (streets; weak on airports) ---

function formatPhotonAddress(properties: Record<string, string | undefined>): string {
  const line1 = [properties.housenumber, properties.street || properties.name]
    .filter(Boolean)
    .join(' ');
  const locality =
    properties.city || properties.town || properties.village || properties.locality;
  const region = properties.state || properties.county;
  const cityState = [locality, region].filter(Boolean).join(', ');
  const parts: string[] = [];
  if (line1) parts.push(line1);
  if (cityState) parts.push(cityState);
  if (properties.postcode) parts.push(properties.postcode);
  const formatted = parts.join(', ').trim();
  return formatted || properties.name?.trim() || '';
}

async function searchPhoton(query: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '10');
  url.searchParams.set('lang', 'en');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': PHOTON_USER_AGENT },
  });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    features?: Array<{ properties?: Record<string, string | undefined> }>;
  };

  const seen = new Set<string>();
  const results: AddressSuggestion[] = [];

  for (const feature of json.features ?? []) {
    const props = feature.properties ?? {};
    const formatted = formatPhotonAddress(props);
    if (formatted.length < 4 || seen.has(formatted)) continue;
    seen.add(formatted);
    results.push({
      id: [props.osm_type, props.osm_id, formatted].filter(Boolean).join(':'),
      label: formatted,
      formatted,
      provider: 'photon',
    });
    if (results.length >= 6) break;
  }
  return results;
}

export async function searchAddresses(
  query: string,
  sessionToken?: string
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    if (MAPBOX_TOKEN && sessionToken) {
      const mapbox = await searchMapbox(trimmed, sessionToken);
      if (mapbox.length > 0) return mapbox;
    }

    if (LOCATIONIQ_KEY) {
      const liq = await searchLocationIq(trimmed);
      if (liq.length > 0) return liq;
    }

    return await searchPhoton(trimmed);
  } catch (err) {
    if (__DEV__) console.warn('[addressSearch] search failed', err);
    return [];
  }
}

export async function resolveAddressSuggestion(
  suggestion: AddressSuggestion,
  sessionToken?: string
): Promise<string> {
  try {
    if (suggestion.provider === 'mapbox' && MAPBOX_TOKEN && sessionToken) {
      const resolved = await resolveMapbox(suggestion.id, sessionToken);
      return resolved ?? suggestion.formatted;
    }
    return suggestion.formatted;
  } catch {
    return suggestion.formatted;
  }
}
