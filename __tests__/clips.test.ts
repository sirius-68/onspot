import type { SupabaseClient } from '@supabase/supabase-js';

import { postClip } from '@/features/clips/api';
import { clipErrorMessage, formatFreshness, liveSecondsLeft } from '@/features/clips/format';
import type { CapturedClip, PostStage } from '@/features/clips/types';

const clip: CapturedClip = {
  uri: 'file:///clip.mp4',
  durationS: 8,
  capturedAt: new Date('2026-11-16T22:00:00Z'),
  lat: 51.5,
  lng: -0.07,
  accuracyM: 12,
};

function fakeClient(opts: {
  createError?: string;
  uploadFailures?: number;
  finalizeError?: string;
}) {
  let uploads = 0;
  const upload = jest.fn(async () => {
    uploads++;
    return uploads <= (opts.uploadFailures ?? 0)
      ? { error: { message: 'network' } }
      : { error: null };
  });
  const rpc = jest.fn(async (name: string) => {
    if (name === 'create_clip') {
      return opts.createError
        ? { data: null, error: { message: opts.createError } }
        : { data: [{ clip_id: 'c1', storage_path: 'u1/c1.mp4' }], error: null };
    }
    return opts.finalizeError
      ? { data: null, error: { message: opts.finalizeError } }
      : { data: 'now', error: null };
  });
  const client = { rpc, storage: { from: () => ({ upload }) } } as unknown as SupabaseClient;
  return { client, rpc, upload };
}

const deps = (client: SupabaseClient, stages: PostStage[] = []) => ({
  client,
  readFile: async () => new ArrayBuffer(4),
  sleep: async () => undefined,
  onStage: (s: PostStage) => stages.push(s),
});

describe('postClip', () => {
  it('creates, uploads to the reserved path, then publishes', async () => {
    const { client, rpc, upload } = fakeClient({});
    const stages: PostStage[] = [];
    await expect(postClip('v1', clip, deps(client, stages))).resolves.toEqual({ clipId: 'c1' });
    expect(rpc).toHaveBeenCalledWith(
      'create_clip',
      expect.objectContaining({ p_venue_id: 'v1', p_accuracy_m: 12 }),
    );
    expect(upload).toHaveBeenCalledWith(
      'u1/c1.mp4',
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'video/mp4' }),
    );
    expect(rpc).toHaveBeenLastCalledWith('finalize_clip', { p_clip_id: 'c1' });
    expect(stages).toEqual(['checking', 'uploading', 'publishing', 'done']);
  });

  it('retries flaky uploads', async () => {
    const { client, upload } = fakeClient({ uploadFailures: 2 });
    await postClip('v1', clip, deps(client));
    expect(upload).toHaveBeenCalledTimes(3);
  });

  it('gives up after three failed uploads', async () => {
    const { client, rpc } = fakeClient({ uploadFailures: 3 });
    await expect(postClip('v1', clip, deps(client))).rejects.toThrow('upload_missing');
    expect(rpc).not.toHaveBeenCalledWith('finalize_clip', expect.anything());
  });

  it('stops when the server says you are not at the venue', async () => {
    const { client, upload } = fakeClient({ createError: 'outside_venue' });
    await expect(postClip('v1', clip, deps(client))).rejects.toThrow('outside_venue');
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('clip formatting', () => {
  const now = new Date('2026-11-16T22:30:00Z');
  it('describes freshness', () => {
    expect(formatFreshness('2026-11-16T22:29:40Z', now)).toBe('just now');
    expect(formatFreshness('2026-11-16T22:26:00Z', now)).toBe('4 min ago');
    expect(formatFreshness('2026-11-16T21:00:00Z', now)).toBe('1 h ago');
  });
  it('counts down the live window', () => {
    expect(liveSecondsLeft('2026-11-16T22:00:00Z', now)).toBe(1800);
    expect(liveSecondsLeft('2026-11-16T20:00:00Z', now)).toBe(0);
  });
  it('maps server codes to friendly text', () => {
    expect(clipErrorMessage(new Error('outside_venue'))).toMatch(/inside the venue/);
    expect(clipErrorMessage(new Error('weird'))).toMatch(/Something went wrong/);
  });
});
