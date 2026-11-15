import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureSession } from '@/lib/supabase';

function fakeAuth(auth: Record<string, jest.Mock>) {
  return { auth } as unknown as SupabaseClient;
}

describe('ensureSession', () => {
  it('reuses an existing session', async () => {
    const signInAnonymously = jest.fn();
    const client = fakeAuth({
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'existing' } } },
        error: null,
      }),
      signInAnonymously,
    });
    await expect(ensureSession(client)).resolves.toBe('existing');
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously when there is no session', async () => {
    const client = fakeAuth({
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: 'anon-1' } }, error: null }),
    });
    await expect(ensureSession(client)).resolves.toBe('anon-1');
  });

  it('surfaces sign-in errors', async () => {
    const client = fakeAuth({
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: jest
        .fn()
        .mockResolvedValue({ data: { user: null }, error: new Error('disabled') }),
    });
    await expect(ensureSession(client)).rejects.toThrow('disabled');
  });
});
