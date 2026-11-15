import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from './AuthProvider';

/**
 * Returns a guard for actions that need an 18+ profile (posting clips, adding friends).
 * Sends people to sign-in or profile setup and returns false when they aren't ready.
 */
export function useRequireProfile() {
  const { hasAccount, profile } = useAuth();
  return useCallback(() => {
    if (!hasAccount) {
      router.push('/sign-in');
      return false;
    }
    if (!profile) {
      router.push('/onboarding');
      return false;
    }
    return true;
  }, [hasAccount, profile]);
}
