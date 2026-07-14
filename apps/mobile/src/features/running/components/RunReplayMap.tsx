import React, { memo, useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import length from '@turf/length';
import lineSliceAlong from '@turf/line-slice-along';
import bearing from '@turf/bearing';
import { lineString } from '@turf/helpers';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors } from '@/theme';

export interface RunReplayMapProps {
  routeCoordinates: number[][]; // Array of [lng, lat]
}

const REPLAY_DURATION_MS = 10000; // 10 seconds

export const RunReplayMap = memo(({ routeCoordinates }: RunReplayMapProps) => {
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCinematicMode, setIsCinematicMode] = useState(false);
  
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const routeLine = useMemo(() => {
    if (routeCoordinates.length < 2) return null;
    return lineString(routeCoordinates);
  }, [routeCoordinates]);

  const totalDistance = useMemo(() => {
    if (!routeLine) return 0;
    return length(routeLine, { units: 'meters' });
  }, [routeLine]);

  const animate = (time: number) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = time - (animationProgress * REPLAY_DURATION_MS);
    }
    
    const elapsed = time - startTimeRef.current;
    let nextProgress = elapsed / REPLAY_DURATION_MS;
    
    if (nextProgress >= 1) {
      nextProgress = 1;
      setAnimationProgress(nextProgress);
      setIsPlaying(false);
      startTimeRef.current = null;
      return;
    }
    
    setAnimationProgress(nextProgress);
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
      startTimeRef.current = null;
    }
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying]);

  const activeData = useMemo(() => {
    if (!routeLine || totalDistance === 0) {
      return {
        line: routeCoordinates.length > 1 ? routeLine : null,
        runnerPos: routeCoordinates.length > 0 ? routeCoordinates[0] : null,
        currentBearing: 0,
      };
    }

    if (animationProgress === 0) {
      return {
        line: null,
        runnerPos: routeCoordinates[0],
        currentBearing: 0,
      };
    }

    if (animationProgress >= 1) {
       const lastPt = routeCoordinates[routeCoordinates.length - 1];
       const prevPt = routeCoordinates[routeCoordinates.length - 2];
       const currentBearing = bearing(prevPt, lastPt);
       return {
         line: routeLine,
         runnerPos: lastPt,
         currentBearing,
       };
    }

    const currentDistance = totalDistance * animationProgress;
    
    // turf slice
    const sliced = lineSliceAlong(routeLine, 0, currentDistance, { units: 'meters' });
    const coords = sliced.geometry.coordinates;
    const runnerPos = coords[coords.length - 1];
    
    let currentBearing = 0;
    if (coords.length > 1) {
       currentBearing = bearing(coords[coords.length - 2], runnerPos);
    }

    return {
      line: sliced,
      runnerPos,
      currentBearing,
    };
  }, [routeLine, totalDistance, animationProgress, routeCoordinates]);

  const togglePlay = () => {
    setIsCinematicMode(true);
    if (animationProgress >= 1) {
      setAnimationProgress(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const restart = () => {
    setIsCinematicMode(true);
    setAnimationProgress(0);
    setIsPlaying(true);
  };

  const bounds = useMemo(() => {
    if (routeCoordinates.length < 2) return null;
    let minLng = routeCoordinates[0][0];
    let maxLng = routeCoordinates[0][0];
    let minLat = routeCoordinates[0][1];
    let maxLat = routeCoordinates[0][1];

    routeCoordinates.forEach(coord => {
      if (coord[0] < minLng) minLng = coord[0];
      if (coord[0] > maxLng) maxLng = coord[0];
      if (coord[1] < minLat) minLat = coord[1];
      if (coord[1] > maxLat) maxLat = coord[1];
    });

    return {
      ne: [maxLng, maxLat],
      sw: [minLng, minLat],
    };
  }, [routeCoordinates]);

  return (
    <View className="flex-1 rounded-3xl overflow-hidden bg-bgPrimary relative">
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL="mapbox://styles/mapbox/satellite-streets-v12"
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        {isCinematicMode && (
          <Mapbox.RasterDemSource
            id="mapbox-dem"
            url="mapbox://mapbox.mapbox-terrain-dem-v1"
            tileSize={512}
            maxZoomLevel={14}
          />
        )}
        {isCinematicMode && (
          <Mapbox.Terrain
            sourceID="mapbox-dem"
            style={{ exaggeration: 1.5 }}
          />
        )}
        {bounds && (
          <Mapbox.Camera
            {...(isCinematicMode
              ? {
                  centerCoordinate: activeData.runnerPos || undefined,
                  pitch: 70,
                  zoomLevel: 16,
                  heading: activeData.currentBearing,
                  animationMode: 'moveTo',
                  animationDuration: 0,
                }
              : {
                  bounds: bounds,
                  padding: { paddingTop: 50, paddingRight: 50, paddingBottom: 50, paddingLeft: 50 },
                  pitch: 0,
                  heading: 0,
                  animationMode: 'flyTo',
                  animationDuration: 1000,
                })}
          />
        )}

        {/* Background Line */}
        {routeLine && (
          <Mapbox.ShapeSource id="route-bg" shape={routeLine}>
            <Mapbox.LineLayer
              id="route-bg-line"
              style={{
                lineColor: 'rgba(255, 255, 255, 0.2)',
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Active Sliced Line */}
        {activeData.line && (
          <Mapbox.ShapeSource id="route-active" shape={activeData.line}>
            <Mapbox.LineLayer
              id="route-active-line"
              style={{
                lineColor: '#00E5FF',
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
                lineColorTransition: { duration: 0, delay: 0 },
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Runner Icon */}
        {activeData.runnerPos && (
          <Mapbox.ShapeSource
            id="runner-pos"
            shape={{
              type: 'Point',
              coordinates: activeData.runnerPos,
            }}
          >
            <Mapbox.CircleLayer
              id="runner-circle-outer"
              style={{
                circleRadius: 10,
                circleColor: 'rgba(0, 229, 255, 0.3)',
                circlePitchAlignment: 'map',
              }}
            />
            <Mapbox.CircleLayer
              id="runner-circle-inner"
              style={{
                circleRadius: 5,
                circleColor: '#FFFFFF',
                circleStrokeColor: '#00E5FF',
                circleStrokeWidth: 2,
                circlePitchAlignment: 'map',
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

      {/* Controls HUD */}
      <View className="absolute bottom-6 w-full flex-row justify-center gap-4">
        <BlurView
          intensity={40}
          tint="dark"
          className="rounded-full overflow-hidden"
        >
          <Pressable
            onPress={togglePlay}
            className="w-14 h-14 items-center justify-center border border-white/20 rounded-full bg-black/20"
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={24}
              color="white"
              style={{ marginLeft: isPlaying ? 0 : 4 }}
            />
          </Pressable>
        </BlurView>

        {(animationProgress > 0 && !isPlaying) && (
          <BlurView
            intensity={40}
            tint="dark"
            className="rounded-full overflow-hidden"
          >
            <Pressable
              onPress={restart}
              className="w-14 h-14 items-center justify-center border border-white/20 rounded-full bg-black/20"
            >
              <Ionicons
                name="refresh"
                size={24}
                color="white"
              />
            </Pressable>
          </BlurView>
        )}
      </View>
    </View>
  );
});
