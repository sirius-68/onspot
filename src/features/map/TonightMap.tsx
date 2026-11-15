import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { FriendBubble, MapBubble } from '@/components/FriendBubble';
import { VenuePin } from '@/components/VenuePin';
import type { FriendLocation } from '@/features/friends/api';
import type { LatLng, NearbyVenue } from '@/features/venues/types';
import { env } from '@/lib/env';
import { colors } from '@/theme/tokens';

import { PHOTO_PIN_MIN_ZOOM, pickPhotoPinVenues, venuesToFeatureCollection } from './geo';

export type TonightMapProps = {
  center: LatLng;
  showUserLocation: boolean;
  venues: NearbyVenue[];
  friends?: FriendLocation[];
  selectedId: string | null;
  onSelect: (venue: NearbyVenue | null) => void;
  /** Pan here (e.g. the venue you swiped to). */
  focus?: LatLng | null;
  /** Your avatar, drawn at your position. */
  me?: { name: string; avatarUrl: string | null } | null;
  /** Changes when the locate button is pressed, to re-centre on you. */
  recenterKey?: number;
};

/**
 * Native map (MapLibre, open source, no API key). Far out, venues are drawn as clustered GL
 * layers (cheap); from PHOTO_PIN_MIN_ZOOM in, the nearest venues get photo pins (views).
 */
export function TonightMap({
  center,
  showUserLocation,
  venues,
  friends = [],
  selectedId,
  onSelect,
  focus = null,
  me = null,
  recenterKey = 0,
}: TonightMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [zoom, setZoom] = useState(15);
  const shape = useMemo(() => venuesToFeatureCollection(venues), [venues]);
  const pinVenues = useMemo(() => pickPhotoPinVenues(venues), [venues]);
  const showPins = zoom >= PHOTO_PIN_MIN_ZOOM;

  // Move the camera only when the centre really changes (e.g. location arrives), so the
  // user's own pans and zooms aren't reset on every render.
  useEffect(() => {
    cameraRef.current?.easeTo({ center: [center.lng, center.lat], zoom: 15, duration: 600 });
  }, [center.lat, center.lng, recenterKey]);

  useEffect(() => {
    if (!focus) return;
    cameraRef.current?.easeTo({
      center: [focus.lng, focus.lat],
      zoom: Math.max(zoom, PHOTO_PIN_MIN_ZOOM + 0.5),
      duration: 450,
    });
    // Zoom is read, not followed: panning shouldn't re-trigger when the user zooms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.lat, focus?.lng]);

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={env.mapStyleUrl}
      logo={false}
      attribution
      compass={false}
      scaleBar={false}
      onPress={() => onSelect(null)}
      onRegionDidChange={(e) => setZoom(e.nativeEvent.zoom)}
    >
      <Camera ref={cameraRef} initialViewState={{ center: [center.lng, center.lat], zoom: 15 }} />
      {showUserLocation && (
        <Marker id="me" lngLat={[center.lng, center.lat]} anchor="center">
          <MapBubble name={me?.name ?? 'You'} avatarUrl={me?.avatarUrl} me size={50} />
        </Marker>
      )}

      <GeoJSONSource
        id="venues"
        data={shape}
        cluster
        clusterRadius={48}
        clusterMaxZoom={PHOTO_PIN_MIN_ZOOM - 1}
        onPress={(e) => {
          const feature = e.nativeEvent.features[0];
          if (!feature) return;
          if (feature.properties?.cluster) {
            const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
            cameraRef.current?.easeTo({
              center: [lng, lat],
              zoom: PHOTO_PIN_MIN_ZOOM + 0.5,
              duration: 500,
            });
            return;
          }
          const venue = venues.find((v) => v.id === feature.properties?.id);
          if (venue) onSelect(venue);
        }}
      >
        <Layer
          id="venue-clusters"
          type="circle"
          filter={['has', 'point_count']}
          maxzoom={PHOTO_PIN_MIN_ZOOM}
          paint={{
            'circle-color': colors.blue,
            'circle-opacity': 0.85,
            'circle-stroke-color': colors.white,
            'circle-stroke-width': 2,
            'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 26],
          }}
        />
        <Layer
          id="venue-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          maxzoom={PHOTO_PIN_MIN_ZOOM}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 13,
            'text-allow-overlap': true,
          }}
          paint={{ 'text-color': colors.white }}
        />
        <Layer
          id="venue-dots"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          maxzoom={PHOTO_PIN_MIN_ZOOM}
          paint={{
            'circle-color': colors.blue,
            'circle-radius': 6,
            'circle-stroke-color': colors.white,
            'circle-stroke-width': 2,
          }}
        />
      </GeoJSONSource>

      {showPins &&
        pinVenues.map((venue) => (
          <Marker
            key={venue.id}
            id={`venue-${venue.id}`}
            lngLat={[venue.lng, venue.lat]}
            anchor="bottom"
            selected={venue.id === selectedId}
          >
            <VenuePin venue={venue} selected={venue.id === selectedId} onPress={onSelect} />
          </Marker>
        ))}

      {friends.map((friend) => (
        <Marker
          key={`friend-${friend.user_id}`}
          id={`friend-${friend.user_id}`}
          lngLat={[friend.lng, friend.lat]}
          anchor="center"
        >
          <FriendBubble friend={friend} />
        </Marker>
      ))}
    </Map>
  );
}
