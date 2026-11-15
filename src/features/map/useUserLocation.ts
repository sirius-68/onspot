import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { env } from '@/lib/env';
import type { LatLng } from '@/features/venues/types';

export type UserLocationState = {
  /** Where the map should centre: the user's position, or the default area as a fallback. */
  center: LatLng;
  /** True once we know whether we have the user's real position. */
  ready: boolean;
  /** 'granted' | 'denied' | 'undetermined' — drives the "turn on location" hint. */
  permission: Location.PermissionStatus | 'undetermined';
  isUserPosition: boolean;
};

/**
 * Asks for foreground location once and falls back to the default area (debugging list D3:
 * denied or approximate location must still give a usable map).
 */
export function useUserLocation(): UserLocationState {
  const [state, setState] = useState<UserLocationState>({
    center: env.defaultCenter,
    ready: false,
    permission: 'undetermined',
    isUserPosition: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          if (!cancelled) setState((s) => ({ ...s, ready: true, permission: status }));
          return;
        }
        const last = await Location.getLastKnownPositionAsync();
        const pos =
          last ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!cancelled) {
          setState({
            center: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            ready: true,
            permission: status,
            isUserPosition: true,
          });
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, ready: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
