export type ClipSource = 'user' | 'host' | 'spotter';

/** A row from the `venue_live_clips` RPC. */
export type LiveClip = {
  id: string;
  venue_id: string;
  author_id: string;
  storage_path: string;
  source: ClipSource;
  published_at: string;
  duration_s: number | null;
  author_username?: string | null;
};

export type CapturedClip = {
  uri: string;
  durationS: number | null;
  capturedAt: Date;
  lat: number;
  lng: number;
  accuracyM: number;
};

export type PostStage = 'idle' | 'checking' | 'uploading' | 'publishing' | 'done' | 'error';
