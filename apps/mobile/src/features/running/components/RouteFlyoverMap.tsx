import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import type { GpsSample } from '@stridequest/shared/running';

interface RouteFlyoverMapProps {
  samples: GpsSample[];
}

// Haversine formula to calculate distance between two coordinates
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
};

export const RouteFlyoverMap: React.FC<RouteFlyoverMapProps> = ({ samples }) => {
  const cameraRef = useRef<MapboxGL.Camera>(null);

  const { route, gradient, bounds } = useMemo(() => {
    if (!samples || samples.length === 0) {
      return { route: null, gradient: null, bounds: null };
    }

    const coordinates = samples.map(s => [s.lng, s.lat]);

    let minLat = samples[0].lat;
    let maxLat = samples[0].lat;
    let minLng = samples[0].lng;
    let maxLng = samples[0].lng;

    // Calculate total distance for line-progress mapping
    let totalDistance = 0;
    const distances = [0];
    for (let i = 1; i < samples.length; i++) {
      const d = getDistance(samples[i - 1].lat, samples[i - 1].lng, samples[i].lat, samples[i].lng);
      totalDistance += d;
      distances.push(totalDistance);

      minLat = Math.min(minLat, samples[i].lat);
      maxLat = Math.max(maxLat, samples[i].lat);
      minLng = Math.min(minLng, samples[i].lng);
      maxLng = Math.max(maxLng, samples[i].lng);
    }

    // Build the gradient array
    // Mapbox expressions: ['interpolate', ['linear'], ['line-progress'], stop1, color1, stop2, color2, ...]
    const gradientStops: any[] = ['interpolate', ['linear'], ['line-progress']];
    
    // Create stops. Too many stops can crash Mapbox or make it slow. 
    const step = Math.max(1, Math.floor(samples.length / 100)); // Max ~100 stops
    
    for (let i = 0; i < samples.length; i += step) {
      const progress = totalDistance === 0 ? 0 : distances[i] / totalDistance;
      const speed = samples[i].speed ?? 0;
      
      // Map speed (m/s) to color. 
      let color = '#FF3B30'; // Red/Orange for slower paces
      if (speed > 4.5) color = '#00FFFF'; // Neon Cyan for sprints
      else if (speed > 3.5) color = '#34C759'; // Green
      else if (speed > 2.5) color = '#FF9500'; // Orange

      gradientStops.push(Math.min(1, Math.max(0, progress)), color);
    }
    
    // Ensure the last point is at progress 1.0 to close the gradient cleanly
    if (distances[distances.length - 1] / totalDistance < 1.0 || step > 1) {
      const lastSpeed = samples[samples.length - 1].speed ?? 0;
      let lastColor = '#FF3B30';
      if (lastSpeed > 4.5) lastColor = '#00FFFF';
      else if (lastSpeed > 3.5) lastColor = '#34C759';
      else if (lastSpeed > 2.5) lastColor = '#FF9500';
      gradientStops.push(1.0, lastColor);
    }

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates,
      },
    };

    return {
      route: geojson,
      gradient: gradientStops,
      bounds: { ne: [maxLng, maxLat], sw: [minLng, minLat] }
    };
  }, [samples]);

  useEffect(() => {
    // Initial delay so the map can render at top-down view first, then animate to 3D flyover
    const timer = setTimeout(() => {
      if (cameraRef.current && bounds) {
        cameraRef.current.setCamera({
          bounds: {
            ne: bounds.ne,
            sw: bounds.sw,
            paddingLeft: 40,
            paddingRight: 40,
            paddingTop: 80,
            paddingBottom: 350, // Space for the bottom panel overlay
          },
          pitch: 65,
          heading: 25, // Slight angled heading for cinematic effect
          animationDuration: 3500,
          animationMode: 'flyTo',
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [bounds]);

  if (!route) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <MapboxGL.MapView 
        style={styles.map} 
        styleURL={MapboxGL.StyleURL.Dark}
        pitchEnabled={false}
        scrollEnabled={false}
        rotateEnabled={false}
        zoomEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          bounds={bounds ? {
            ne: bounds.ne,
            sw: bounds.sw,
            paddingLeft: 40,
            paddingRight: 40,
            paddingTop: 40,
            paddingBottom: 40,
          } : undefined}
          pitch={0} // Start top-down
          animationDuration={0}
        />

        <MapboxGL.ShapeSource id="routeSource" shape={route} lineMetrics={true}>
          <MapboxGL.LineLayer
            id="routeLayer"
            style={{
              lineColor: 'red', // Fallback
              lineGradient: gradient as any,
              lineWidth: 6,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
  },
});
