import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNearbyVenues } from '@/features/map/useNearbyVenues';
import { formatDistance } from '@/features/venues/format';
import type { NearbyVenue } from '@/features/venues/types';
import { ensureSession, supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { colors, radii, spacing, typography } from '@/theme/tokens';

import { postClip } from './api';
import { clipErrorMessage } from './format';
import type { CapturedClip, PostStage } from './types';
import { liveClipsKey } from './useLiveClips';

const MAX_SECONDS = 15;
/** Venues further than this from where you recorded aren't offered. */
const PICK_RADIUS_M = 150;

const STAGE_TEXT: Record<PostStage, string> = {
  idle: '',
  checking: 'Checking you’re at the venue…',
  uploading: 'Uploading…',
  publishing: 'Going live…',
  done: 'Live!',
  error: '',
};

/** In-app capture only (no gallery import): record ≤15 s, pick the venue, post. */
export function CaptureScreen() {
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const queryClient = useQueryClient();

  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<CapturedClip | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [stage, setStage] = useState<PostStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const nearby = useNearbyVenues(clip ? { lat: clip.lat, lng: clip.lng } : null, PICK_RADIUS_M);
  const options: NearbyVenue[] = nearby.data ?? [];
  const chosenId = venueId ?? options[0]?.id ?? null;

  if (!camPerm || !micPerm) return <View style={styles.black} />;
  if (!camPerm.granted || !micPerm.granted) {
    return (
      <SafeAreaView style={[styles.black, styles.center]}>
        <Text style={styles.title}>Show the vibe</Text>
        <Text style={styles.body}>
          Onspot needs the camera and microphone to record live clips. Clips are only shot in the
          app, never imported, so everyone knows they’re real.
        </Text>
        <Pressable
          style={styles.primary}
          onPress={async () => {
            await requestCam();
            await requestMic();
          }}
        >
          <Text style={styles.primaryText}>Allow camera and microphone</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  async function startRecording() {
    setError(null);
    const loc = await Location.requestForegroundPermissionsAsync();
    if (loc.status !== Location.PermissionStatus.GRANTED) {
      setError('Location is needed to prove you’re at the venue.');
      return;
    }
    const startedAt = new Date();
    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    setRecording(true);
    try {
      const result = await cameraRef.current?.recordAsync({ maxDuration: MAX_SECONDS });
      const position = await positionPromise;
      if (!result?.uri) throw new Error('Recording failed');
      setClip({
        uri: result.uri,
        durationS: Math.min(MAX_SECONDS, (Date.now() - startedAt.getTime()) / 1000),
        capturedAt: startedAt,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy ?? 75,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recording failed');
    } finally {
      setRecording(false);
    }
  }

  async function post() {
    if (!clip || !chosenId) return;
    setError(null);
    try {
      await ensureSession();
      await postClip(chosenId, clip, {
        client: supabase,
        readFile: (uri) => new File(uri).arrayBuffer(),
        onStage: setStage,
      });
      track('clip_posted', { venue_id: chosenId });
      await queryClient.invalidateQueries({ queryKey: liveClipsKey(chosenId) });
      setTimeout(() => router.back(), 600);
    } catch (e) {
      setStage('error');
      setError(clipErrorMessage(e));
    }
  }

  if (clip) {
    const busy = stage === 'checking' || stage === 'uploading' || stage === 'publishing';
    return (
      <SafeAreaView style={styles.sheet}>
        <Text style={styles.title}>Where are you?</Text>
        <Text style={styles.body}>
          Pick the venue you’re in. We check your location matches before it goes live.
        </Text>
        {nearby.isPending ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : options.length === 0 ? (
          <Text style={[styles.body, { color: colors.warning }]}>
            No Onspot venues within {PICK_RADIUS_M} m of you.
          </Text>
        ) : (
          <FlatList
            data={options}
            keyExtractor={(v) => v.id}
            style={{ flexGrow: 0, maxHeight: 280 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setVenueId(item.id)}
                style={[styles.option, item.id === chosenId && styles.optionActive]}
              >
                <Text style={styles.optionName}>{item.name}</Text>
                <Text style={styles.optionMeta}>{formatDistance(item.distance_m)}</Text>
              </Pressable>
            )}
          />
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {busy || stage === 'done' ? (
          <Text style={styles.stage}>{STAGE_TEXT[stage]}</Text>
        ) : (
          <Pressable
            style={[styles.primary, !chosenId && { opacity: 0.4 }]}
            disabled={!chosenId}
            onPress={post}
          >
            <Text style={styles.primaryText}>Post live clip</Text>
          </Pressable>
        )}
        <Pressable
          disabled={busy}
          onPress={() => {
            setClip(null);
            setStage('idle');
            setError(null);
          }}
        >
          <Text style={styles.link}>Record again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.black}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} mode="video" facing="back" />
      <SafeAreaView style={styles.cameraUi} pointerEvents="box-none">
        <Pressable
          accessibilityLabel="Close camera"
          onPress={() => router.back()}
          style={styles.close}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.bottom}>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.hint}>
            {recording ? 'Recording… tap to stop' : `Tap to record up to ${MAX_SECONDS} s`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
            onPress={() => (recording ? cameraRef.current?.stopRecording() : startRecording())}
            style={[styles.shutter, recording && styles.shutterRec]}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  sheet: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.textMuted },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryText: { ...typography.heading, color: '#fff' },
  link: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.md },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  optionActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionName: { ...typography.heading, color: colors.text },
  optionMeta: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger, textAlign: 'center' },
  stage: { ...typography.heading, color: colors.live, textAlign: 'center', marginTop: spacing.md },
  cameraUi: { flex: 1, justifyContent: 'space-between' },
  close: { padding: spacing.lg },
  bottom: { alignItems: 'center', paddingBottom: spacing.xxl, gap: spacing.md },
  hint: { ...typography.caption, color: colors.text },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 6,
    borderColor: colors.text,
    backgroundColor: colors.accent,
  },
  shutterRec: { backgroundColor: colors.danger, borderRadius: 18 },
});
