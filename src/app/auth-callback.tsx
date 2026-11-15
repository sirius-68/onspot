import { Redirect } from 'expo-router';

// OAuth returns here; the sign-in screen finishes the code exchange.
export default function AuthCallback() {
  return <Redirect href="/onboarding" />;
}
