import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

import { fetchFriendLocations, fetchFriends, shareMyLocation } from './api';

export const friendsKey = ['friends'] as const;
export const friendLocationsKey = ['friend-locations'] as const;

export function useFriends() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: friendsKey,
    queryFn: () => fetchFriends(supabase),
    enabled: !!profile,
  });
}

export function useFriendLocations() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: friendLocationsKey,
    queryFn: () => fetchFriendLocations(supabase),
    enabled: !!profile,
    refetchInterval: 60_000,
  });
}

/**
 * While the map is open and Ghost Mode is off, shares your position with friends every
 * 2 minutes. Foreground only: Onspot never asks for background location.
 */
export function useShareLocationWhileOpen(active: boolean) {
  const { profile } = useAuth();
  const enabled = active && !!profile && !profile.ghost_mode;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== Location.PermissionStatus.GRANTED || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          await shareMyLocation(
            supabase,
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy ?? 100,
          );
        }
      } catch {
        // Location sharing is best effort.
      }
    };
    void tick();
    const id = setInterval(tick, 120_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);
}
