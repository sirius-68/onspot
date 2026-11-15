import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SquadVoteScreen } from '@/features/squads/SquadVoteScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ code: 'abc123' }),
}));
jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: null, profile: null }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const mockCastVote = jest.fn();
jest.mock('@/features/squads/api', () => {
  const actual = jest.requireActual('@/features/squads/api');
  return {
    ...actual,
    getGuestKey: async () => 'guest-key-1234567890',
    getGuestName: async () => '',
    setGuestName: async () => undefined,
    castVote: (...args: unknown[]) => mockCastVote(...args),
    fetchSquad: async () => ({
      code: 'abc123',
      title: 'Friday?',
      closes_at: new Date(Date.now() + 3600_000).toISOString(),
      closed: false,
      creator_username: 'marry',
      is_creator: false,
      total_votes: 1,
      my_option_id: null,
      options: [
        {
          option_id: 'o1',
          venue_id: 'v1',
          name: 'Neon Basement',
          category: 'club',
          cover_photo_url: null,
          votes: 1,
          voters: ['Ben'],
        },
        {
          option_id: 'o2',
          venue_id: 'v2',
          name: 'Corner Pint',
          category: 'bar',
          cover_photo_url: null,
          votes: 0,
          voters: [],
        },
      ],
    }),
  };
});

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <QueryClientProvider client={client}>
        <SquadVoteScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('SquadVoteScreen (web guest)', () => {
  it('shows the options and who is winning', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Friday?')).toBeTruthy());
    expect(screen.getByText(/Neon Basement is winning/)).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('asks a guest for a name before voting, then votes with the guest key', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Friday?')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Vote for Corner Pint'));
    expect(screen.getByText('Add your name so friends know who voted.')).toBeTruthy();
    expect(mockCastVote).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Marry'), 'Dee');
    await fireEvent.press(screen.getByLabelText('Vote for Corner Pint'));
    await waitFor(() =>
      expect(mockCastVote).toHaveBeenCalledWith({}, 'abc123', 'o2', {
        key: 'guest-key-1234567890',
        name: 'Dee',
      }),
    );
  });
});
