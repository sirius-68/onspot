import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TonightScreen } from '@/features/map/TonightScreen';
import type { TonightMapProps } from '@/features/map/TonightMap';

import { makeVenue } from './helpers/fixtures';

// The native map can't render in Jest; replace it with a list of buttons that call onSelect.
jest.mock('@/features/map/TonightMap', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TonightMap: ({ venues, onSelect }: TonightMapProps) => (
      <>
        {venues.map((v) => (
          <Pressable key={v.id} onPress={() => onSelect(v)} accessibilityLabel={`pin-${v.name}`}>
            <Text>{v.name}</Text>
          </Pressable>
        ))}
      </>
    ),
  };
});

const mockLocation = jest.fn();
jest.mock('@/features/map/useUserLocation', () => ({ useUserLocation: () => mockLocation() }));

const mockVenues = jest.fn();
jest.mock('@/features/map/useVenueSearch', () => ({ useVenueSearch: () => mockVenues() }));
jest.mock('@/features/friends/hooks', () => ({
  useFriendLocations: () => ({ data: [] }),
  useShareLocationWhileOpen: () => undefined,
}));
const mockRequireProfile = jest.fn(() => false);
jest.mock('@/features/auth/useRequireProfile', () => ({
  useRequireProfile: () => mockRequireProfile,
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useIsFocused: () => true,
}));

jest.mock('@/lib/env', () => ({ env: { demoMode: false, defaultCenter: { lat: 0, lng: 0 } } }));

async function renderScreen() {
  return await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <TonightScreen />
    </SafeAreaProvider>,
  );
}

const readyLocation = {
  center: { lat: 51.52, lng: -0.07 },
  ready: true,
  permission: 'granted',
  isUserPosition: true,
};

describe('TonightScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRequireProfile.mockClear();
  });

  it('shows a loading status while location and venues load', async () => {
    mockLocation.mockReturnValue({ ...readyLocation, ready: false });
    mockVenues.mockReturnValue({ data: undefined, isPending: true, isFetching: false });
    await renderScreen();
    expect(screen.getByText('Finding what’s on…')).toBeTruthy();
  });

  it('counts venues and opens the card when a pin is tapped', async () => {
    mockLocation.mockReturnValue(readyLocation);
    mockVenues.mockReturnValue({
      data: [
        makeVenue({ id: 'a', name: 'Neon Basement' }),
        makeVenue({ id: 'b', name: 'Corner Pint' }),
      ],
      isPending: false,
      isError: false,
      isFetching: false,
    });
    await renderScreen();
    expect(screen.getByText('2 venues near you tonight')).toBeTruthy();
    expect(screen.getByTestId('capture-fab')).toBeTruthy();
    expect(screen.queryByTestId('venue-card')).toBeNull();

    await fireEvent.press(screen.getByLabelText('pin-Corner Pint'));
    expect(screen.getByTestId('venue-card')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Close venue card'));
    expect(screen.queryByTestId('venue-card')).toBeNull();
  });

  it('offers a retry when loading fails', async () => {
    const refetch = jest.fn();
    mockLocation.mockReturnValue(readyLocation);
    mockVenues.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      refetch,
    });
    await renderScreen();
    await fireEvent.press(screen.getByTestId('map-status'));
    expect(refetch).toHaveBeenCalled();
  });

  it('sends people without a profile to sign in before recording', async () => {
    mockLocation.mockReturnValue(readyLocation);
    mockVenues.mockReturnValue({ data: [], isPending: false, isError: false, isFetching: false });
    await renderScreen();
    await fireEvent.press(screen.getByTestId('capture-fab'));
    expect(mockRequireProfile).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith('/capture');
  });

  it('shows live counts', async () => {
    mockLocation.mockReturnValue(readyLocation);
    mockVenues.mockReturnValue({
      data: [makeVenue({ id: 'a', live_clip_count: 2 }), makeVenue({ id: 'b' })],
      isPending: false,
      isError: false,
      isFetching: false,
    });
    await renderScreen();
    expect(screen.getByText('2 venues · 1 live now')).toBeTruthy();
  });

  it('explains when location is off', async () => {
    mockLocation.mockReturnValue({ ...readyLocation, permission: 'denied', isUserPosition: false });
    mockVenues.mockReturnValue({ data: [], isPending: false, isError: false, isFetching: false });
    await renderScreen();
    expect(screen.getByText(/Location is off/)).toBeTruthy();
  });
});
