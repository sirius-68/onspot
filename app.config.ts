import type { ConfigContext, ExpoConfig } from 'expo/config';

// Keys are read from the environment (EAS secrets / a local .env) and never committed:
// the repo is public. See .env.example.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Onspot',
  slug: 'onspot',
  scheme: 'onspot',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B0B12',
  ios: {
    bundleIdentifier: 'app.onspot',
    supportsTablet: false,
  },
  android: {
    package: 'app.onspot',
    adaptiveIcon: {
      backgroundColor: '#0B0B12',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    output: 'static',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    // MapLibre: open-source maps, no API key or download token needed.
    '@maplibre/maplibre-react-native',
    [
      'expo-camera',
      {
        cameraPermission: 'Onspot uses the camera to record live clips of the venue you are at.',
        microphonePermission: 'Onspot records sound with your clips so people can hear the vibe.',
        recordAudioAndroid: true,
      },
    ],
    'expo-video',
    'expo-web-browser',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Onspot uses your location to show venues near you and to verify clips you shoot at a venue.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
