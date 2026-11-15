import { parseEnv } from '@/lib/env';

describe('parseEnv', () => {
  const full = {
    EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    EXPO_PUBLIC_DEFAULT_LAT: '6.4281',
    EXPO_PUBLIC_DEFAULT_LNG: '3.4219',
  };

  it('reads all values when present', () => {
    const { env, missing } = parseEnv(full);
    expect(missing).toEqual([]);
    expect(env.supabaseUrl).toBe('https://x.supabase.co');
    expect(env.defaultCenter).toEqual({ lat: 6.4281, lng: 3.4219 });
    expect(env.demoMode).toBe(false);
    expect(env.mapStyleUrl).toMatch(/^https:\/\//);
  });

  it('runs in demo mode without Supabase keys', () => {
    expect(parseEnv({}).env.demoMode).toBe(true);
  });

  it('lists missing required keys', () => {
    const { missing } = parseEnv({ EXPO_PUBLIC_SUPABASE_URL: '  ' });
    expect(missing).toEqual(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  });

  it('falls back to the sample area when the default centre is missing or invalid', () => {
    expect(parseEnv({ ...full, EXPO_PUBLIC_DEFAULT_LAT: '' }).env.defaultCenter).toEqual({
      lat: 51.5246,
      lng: -0.0781,
    });
    expect(parseEnv({ ...full, EXPO_PUBLIC_DEFAULT_LAT: '123' }).env.defaultCenter.lat).toBe(
      51.5246,
    );
  });
});
