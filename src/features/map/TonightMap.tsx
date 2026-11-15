import Mapbox, {
  Camera,
  CircleLayer,
  LocationPuck,
  MapView,
  MarkerView,
  ShapeSource,
  StyleURL,
  SymbolLayer,
} from '@rnmapbox/maps';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { VenuePin } from '@/components/VenuePin';
import { env } from '@/lib/env';
import type { LatLng, NearbyVenue } from '@/features/venues/types';
import { colors } from '@/theme/tokens';

import { PHOTO_PIN_MIN_ZOOM, pickPhotoPinVenues, venuesToFeatureCollection } from './geo';

void Mapbox.setAccessToken(env.mapboxToken || null);

export type TonightMapProps = {
  center: LatLng;
  showUserLocation: boolean;
  venues: NearbyVenue[];
  selectedId: string | null;
  onSelect: (venue: NearbyVenue | null) => void;
};

/**
 * Native map. Far out, venues are drawn as clustered GL layers (cheap); from
 * PHOTO_PIN_MIN_ZOOM in, the nearest venues get photo pins (React views).
 */
export function TonightMap({
  center,
  showUserLocation,
  venues,
  selectedId,
  onSelect,
}: TonightMapProps) {
  const cameraRef = useRef<Camera>(null);
  const shape = useMemo(() => venuesToFeatureCollection(venues), [venues]);
  const pinVenues = useMemo(() => pickPhotoPinVenues(venues), [venues]);

  // Move the camera only when the centre really changes (e.g. location arrives), so the
  // user's own pans and zooms aren't reset on every render.
  useEffect(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: [center.lng, center.lat],
      zoomLevel: 15,
      animationDuration: 600,
    });
  }, [center.lat, center.lng]);

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL={StyleURL.Dark}
      logoEnabled
      attributionEnabled
      scaleBarEnabled={false}
      compassEnabled={false}
      onPress={() => onSelect(null)}
    >
      <Camera
        ref={cameraRef}
        defaultSettings={{ centerCoordinate: [center.lng, center.lat], zoomLevel: 15 }}
      />
      {showUserLocation && <LocationPuck puckBearingEnabled pulsing={{ isEnabled: true }} />}

      <ShapeSource
        id="venues"
        shape={shape}
        cluster
        clusterRadius={48}
        clusterMaxZoomLevel={PHOTO_PIN_MIN_ZOOM - 1}
        onPress={(e) => {
          const feature = e.features[0];
          if (!feature || feature.properties?.cluster) {
            cameraRef.current?.setCamera({
              centerCoordinate: [e.coordinates.longitude, e.coordinates.latitude],
              zoomLevel: PHOTO_PIN_MIN_ZOOM + 0.5,
              animationDuration: 500,
            });
            return;
          }
          const venue = venues.find((v) => v.id === feature.properties?.id);
          if (venue) onSelect(venue);
        }}
      >
        <CircleLayer
          id="venue-clusters"
          filter={['has', 'point_count']}
          maxZoomLevel={PHOTO_PIN_MIN_ZOOM}
          style={{
            circleColor: colors.accent,
            circleOpacity: 0.85,
            circleStrokeColor: colors.background,
            circleStrokeWidth: 2,
            circleRadius: ['step', ['get', 'point_count'], 16, 10, 20, 30, 26],
          }}
        />
        <SymbolLayer
          id="venue-cluster-count"
          filter={['has', 'point_count']}
          maxZoomLevel={PHOTO_PIN_MIN_ZOOM}
          style={{
            textField: ['get', 'point_count_abbreviated'],
            textSize: 13,
            textColor: colors.text,
            textAllowOverlap: true,
          }}
        />
        <CircleLayer
          id="venue-dots"
          filter={['!', ['has', 'point_count']]}
          maxZoomLevel={PHOTO_PIN_MIN_ZOOM}
          style={{
            circleColor: colors.accent,
            circleRadius: 6,
            circleStrokeColor: colors.background,
            circleStrokeWidth: 2,
          }}
        />
      </ShapeSource>

      {pinVenues.map((venue) => (
        <MarkerView
          key={venue.id}
          coordinate={[venue.lng, venue.lat]}
          anchor={{ x: 0.5, y: 0.5 }}
          minZoom={PHOTO_PIN_MIN_ZOOM}
          allowOverlap={false}
          isSelected={venue.id === selectedId}
        >
          <VenuePin venue={venue} selected={venue.id === selectedId} onPress={onSelect} />
        </MarkerView>
      ))}
    </MapView>
  );
}
