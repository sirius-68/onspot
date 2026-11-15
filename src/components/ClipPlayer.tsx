import { useVideoPlayer, type VideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

type Props = { url: string; active: boolean; muted: boolean };

// expo-video players are imperative objects; changes go through these helpers.
function applyMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

/**
 * One clip. Only the active (visible) clip plays; others are paused so the carousel keeps
 * memory flat (debugging list D8).
 */
export function ClipPlayer({ url, active, muted }: Props) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  useEffect(() => {
    applyMuted(player, muted);
  }, [player, muted]);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [player, active]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}
