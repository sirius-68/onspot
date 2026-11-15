import type { SupabaseClient } from '@supabase/supabase-js';

import type { CapturedClip, LiveClip, PostStage } from './types';

export const CLIPS_BUCKET = 'clips';

export async function fetchLiveClips(client: SupabaseClient, venueId: string): Promise<LiveClip[]> {
  const { data, error } = await client.rpc('venue_live_clips', { p_venue_id: venueId });
  if (error) throw new Error(error.message);
  return (data ?? []) as LiveClip[];
}

export function clipPublicUrl(client: SupabaseClient, storagePath: string): string {
  return client.storage.from(CLIPS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export type PostClipDeps = {
  client: SupabaseClient;
  /** Reads the recorded file. Injected so tests don't touch the file system. */
  readFile: (uri: string) => Promise<ArrayBuffer>;
  sleep?: (ms: number) => Promise<void>;
  onStage?: (stage: PostStage) => void;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Posts a clip: the server checks location + time and reserves a path, the file is uploaded
 * (retried with backoff for bad club signal, debugging list D7), then the server publishes it.
 */
export async function postClip(
  venueId: string,
  clip: CapturedClip,
  { client, readFile, sleep = defaultSleep, onStage }: PostClipDeps,
): Promise<{ clipId: string }> {
  onStage?.('checking');
  const created = await client.rpc('create_clip', {
    p_venue_id: venueId,
    p_lat: clip.lat,
    p_lng: clip.lng,
    p_accuracy_m: clip.accuracyM,
    p_captured_at: clip.capturedAt.toISOString(),
    p_duration_s: clip.durationS,
  });
  if (created.error) throw new Error(created.error.message);
  const row = (created.data as { clip_id: string; storage_path: string }[] | null)?.[0];
  if (!row) throw new Error('create_clip returned nothing');

  onStage?.('uploading');
  const body = await readFile(clip.uri);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await client.storage
      .from(CLIPS_BUCKET)
      .upload(row.storage_path, body, { contentType: 'video/mp4', upsert: true });
    if (!error) {
      lastError = undefined;
      break;
    }
    lastError = error;
    await sleep(1000 * 2 ** attempt);
  }
  if (lastError) throw new Error('upload_missing');

  onStage?.('publishing');
  const finalized = await client.rpc('finalize_clip', { p_clip_id: row.clip_id });
  if (finalized.error) throw new Error(finalized.error.message);

  onStage?.('done');
  return { clipId: row.clip_id };
}
