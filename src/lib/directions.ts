import { Linking, Platform } from 'react-native';

/** Walking directions URL: Apple Maps on iOS, Google Maps elsewhere (debugging list: 4.3). */
export function directionsUrl(platform: string, lat: number, lng: number, label: string): string {
  const dest = `${lat},${lng}`;
  if (platform === 'ios') {
    return `http://maps.apple.com/?daddr=${dest}&dirflg=w&q=${encodeURIComponent(label)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
}

export async function openDirections(lat: number, lng: number, label: string) {
  await Linking.openURL(directionsUrl(Platform.OS, lat, lng, label));
}
