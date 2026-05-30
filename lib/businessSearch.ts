/**
 * Business name autocomplete for onboarding ("Where do you work?").
 *
 * Default (no API key): Photon — OpenStreetMap search-as-you-type, free.
 *   https://photon.komoot.io/
 *
 * Better coverage (optional, same keys as address search):
 *   Mapbox Search Box — POI / business names, 100k sessions/month free
 *   LocationIQ — 5,000 requests/day free
 */

export type BusinessSearchProvider = 'mapbox' | 'locationiq' | 'photon';

export type BusinessSuggestion = {
  id: string;
  name: string;
  label: string;
  provider: BusinessSearchProvider;
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
const LOCATIONIQ_KEY = process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY?.trim();
const PHOTON_USER_AGENT = 'MyFavoriteServices/1.0';

const BUSINESS_OSM_KEYS = new Set([
  'shop',
  'amenity',
  'office',
  'healthcare',
  'craft',
  'tourism',
  'leisure',
  'building',
  'industrial',
  'commercial',
]);

function formatLocationSubtitle(props: Record<string, string | undefined>): string {
  const locality =
    props.city || props.town || props.village || props.locality || props.district;
  const region = props.state || props.county;
  return [locality, region].filter(Boolean).join(', ');
}

function formatBusinessLabel(
  name: string,
  props: Record<string, string | undefined>
): string {
  const place = formatLocationSubtitle(props);
  if (place) return `${name} — ${place}`;
  if (props.country && props.country !== 'United States') {
    return `${name} — ${props.country}`;
  }
  return name;
}

function isBusinessPoi(props: Record<string, string | undefined>): boolean {
  const name = props.name?.trim();
  if (!name || name.length < 2) return false;

  if (props.osm_key && BUSINESS_OSM_KEYS.has(props.osm_key)) return true;
  if (props.brand?.trim() || props.operator?.trim()) return true;

  const type = props.type;
  if (type && !['house', 'street', 'locality', 'district'].includes(type)) {
    return Boolean(props.osm_key && props.osm_key !== 'place' && props.osm_key !== 'highway');
  }

  return false;
}

// --- Mapbox POI ---

type MapboxSuggestItem = {
  mapbox_id: string;
  name?: string;
  name_preferred?: string;
  full_address?: string;
  place_formatted?: string;
  poi_category?: string[];
};

async function searchMapboxBusinesses(
  query: string,
  sessionToken: string
): Promise<BusinessSuggestion[]> {
  const url = new URL('https://api.mapbox.com/search/searchbox/v1/suggest');
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', MAPBOX_TOKEN!);
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('limit', '8');
  url.searchParams.set('language', 'en');
  url.searchParams.set('country', 'us');
  url.searchParams.set('types', 'poi');

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (__DEV__) console.warn('[businessSearch] Mapbox suggest HTTP', res.status);
    return [];
  }

  const json = (await res.json()) as { suggestions?: MapboxSuggestItem[] };
  const seen = new Set<string>();
  const results: BusinessSuggestion[] = [];

  for (const s of json.suggestions ?? []) {
    const name = (s.name_preferred || s.name || '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const subtitle = s.place_formatted || s.full_address || '';
    const label =
      subtitle && !subtitle.toLowerCase().startsWith(name.toLowerCase())
        ? `${name} — ${subtitle}`
        : name;

    results.push({
      id: s.mapbox_id,
      name,
      label,
      provider: 'mapbox',
    });
  }
  return results;
}

// --- LocationIQ ---

type LocationIqItem = {
  place_id: string | number;
  display_name: string;
  class?: string;
  type?: string;
  name?: string;
};

const LOCATIONIQ_BUSINESS_CLASSES = new Set([
  'amenity',
  'shop',
  'office',
  'tourism',
  'leisure',
  'healthcare',
  'craft',
  'building',
  'commercial',
]);

async function searchLocationIqBusinesses(query: string): Promise<BusinessSuggestion[]> {
  const url = new URL('https://us1.locationiq.com/v1/autocomplete');
  url.searchParams.set('key', LOCATIONIQ_KEY!);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '10');
  url.searchParams.set('dedupe', '1');
  url.searchParams.set('countrycodes', 'us');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const json = (await res.json()) as LocationIqItem[] | { error?: string };
  if (!Array.isArray(json)) return [];

  const seen = new Set<string>();
  const results: BusinessSuggestion[] = [];

  for (const item of json) {
    const osmClass = item.class ?? '';
    if (osmClass && !LOCATIONIQ_BUSINESS_CLASSES.has(osmClass)) continue;

    const display = item.display_name?.trim() ?? '';
    if (display.length < 3) continue;

    const name =
      item.name?.trim() ||
      display.split(',')[0]?.trim() ||
      display;
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    results.push({
      id: String(item.place_id),
      name,
      label: display,
      provider: 'locationiq',
    });
    if (results.length >= 8) break;
  }
  return results;
}

// --- Photon (OpenStreetMap, free, no key) ---

async function searchPhotonBusinesses(query: string): Promise<BusinessSuggestion[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '15');
  url.searchParams.set('lang', 'en');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': PHOTON_USER_AGENT },
  });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    features?: { properties?: Record<string, string | undefined> }[];
  };

  const seen = new Set<string>();
  const results: BusinessSuggestion[] = [];

  for (const feature of json.features ?? []) {
    const props = feature.properties ?? {};
    if (!isBusinessPoi(props)) continue;

    const name = props.name!.trim();
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: [props.osm_type, props.osm_id, name].filter(Boolean).join(':'),
      name,
      label: formatBusinessLabel(name, props),
      provider: 'photon',
    });
    if (results.length >= 8) break;
  }
  return results;
}

export async function searchBusinesses(
  query: string,
  sessionToken?: string
): Promise<BusinessSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    if (MAPBOX_TOKEN && sessionToken) {
      const mapbox = await searchMapboxBusinesses(trimmed, sessionToken);
      if (mapbox.length > 0) return mapbox;
    }

    if (LOCATIONIQ_KEY) {
      const liq = await searchLocationIqBusinesses(trimmed);
      if (liq.length > 0) return liq;
    }

    return await searchPhotonBusinesses(trimmed);
  } catch (err) {
    if (__DEV__) console.warn('[businessSearch] search failed', err);
    return [];
  }
}
