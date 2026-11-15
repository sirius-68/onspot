// Reads public runtime config. Expo inlines EXPO_PUBLIC_* variables at build time, so each
// one must be referenced by its full literal name (no dynamic process.env[key] lookups).

export type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  mapboxToken: string;
  defaultCenter: { lat: number; lng: number };
};

// Dev sample area until the launch city is chosen: London, Shoreditch.
const FALLBACK_CENTER = { lat: 51.5246, lng: -0.0781 };

export type RawEnv = Record<string, string | undefined>;

function parseCoordinate(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function parseEnv(raw: RawEnv): { env: AppEnv; missing: string[] } {
  const missing: string[] = [];
  const required = (name: string): string => {
    const value = raw[name]?.trim();
    if (!value) missing.push(name);
    return value ?? '';
  };

  const lat = parseCoordinate(raw.EXPO_PUBLIC_DEFAULT_LAT, -90, 90);
  const lng = parseCoordinate(raw.EXPO_PUBLIC_DEFAULT_LNG, -180, 180);

  return {
    env: {
      supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL'),
      supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
      mapboxToken: required('EXPO_PUBLIC_MAPBOX_TOKEN'),
      defaultCenter: lat !== null && lng !== null ? { lat, lng } : FALLBACK_CENTER,
    },
    missing,
  };
}

const parsed = parseEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_MAPBOX_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
  EXPO_PUBLIC_DEFAULT_LAT: process.env.EXPO_PUBLIC_DEFAULT_LAT,
  EXPO_PUBLIC_DEFAULT_LNG: process.env.EXPO_PUBLIC_DEFAULT_LNG,
});

export const env = parsed.env;
export const missingEnv = parsed.missing;

if (missingEnv.length > 0 && process.env.NODE_ENV !== 'test') {
  console.warn(`[onspot] Missing env: ${missingEnv.join(', ')} — copy .env.example to .env`);
}
