import { describe, it, expect } from '@jest/globals'
import { getRouteBounds, projectCoordinates, generatePolyline, validateRoute } from '@/features/share/utils/route-renderer'
import { computeFitScale } from '@/features/share/utils/fit-scale'

describe('Route Renderer Utils', () => {
  describe('getRouteBounds', () => {
    it('returns null for empty route', () => {
      expect(getRouteBounds([])).toBeNull()
    })

    it('calculates bounds correctly', () => {
      const route = [
        { lat: 10, lng: 20 },
        { lat: 15, lng: 18 },
        { lat: 12, lng: 25 },
      ]
      expect(getRouteBounds(route)).toEqual({
        minLat: 10,
        maxLat: 15,
        minLng: 18,
        maxLng: 25,
      })
    })
  })

  describe('projectCoordinates', () => {
    it('returns empty array for empty route', () => {
      expect(projectCoordinates([], { width: 100, height: 100 })).toEqual([])
    })

    it('projects a single point to the center of the viewport', () => {
      const route = [{ lat: 10, lng: 10 }]
      const projected = projectCoordinates(route, { width: 100, height: 100 })
      expect(projected).toEqual([{ x: 50, y: 50 }])
    })

    it('projects and scales multiple points', () => {
      const route = [
        { lat: 0, lng: 0 },
        { lat: 10, lng: 10 },
      ]
      // Viewport 100x100, 10% padding = 10px each side, usable = 80x80
      // bounds: minLat 0, maxLat 10, minLng 0, maxLng 10
      // scale = 80 / 10 = 8
      // point 0: x = 0 + 10 (offset), y = (10 - 0) * 8 + 10 = 90
      // point 1: x = 10*8 + 10 = 90, y = (10 - 10) * 8 + 10 = 10
      const projected = projectCoordinates(route, { width: 100, height: 100 })
      expect(projected).toEqual([
        { x: 10, y: 90 },
        { x: 90, y: 10 },
      ])
    })
  })

  describe('generatePolyline', () => {
    it('returns empty string for no points', () => {
      expect(generatePolyline([])).toBe('')
    })

    it('generates svg polyline points string', () => {
      const points = [{ x: 10, y: 90 }, { x: 90, y: 10 }]
      expect(generatePolyline(points)).toBe('10,90 90,10')
    })
  })

  describe('validateRoute', () => {
    it('renders placeholder for short route', () => {
      // Very short distance
      expect(validateRoute([{lat: 10, lng: 10}, {lat: 10.00001, lng: 10.00001}])).toBe(false)
      // Very short bounds
      expect(validateRoute([{lat: 10, lng: 10}, {lat: 10.00001, lng: 10.00001}])).toBe(false)
    })

    it('renders polyline for valid route', () => {
      // Good distance and bounds
      expect(validateRoute([{lat: 10, lng: 10}, {lat: 10.1, lng: 10.1}])).toBe(true)
    })

    it('renders a long, near-straight route (one axis tiny, distance ok)', () => {
      // latDiff = 0.1 (large), lngDiff = 0.00001 (tiny). AND-logic must NOT reject.
      const route = [
        { lat: 10, lng: 10 },
        { lat: 10.05, lng: 10.00001 },
        { lat: 10.1, lng: 10.00002 },
      ]
      expect(validateRoute(route)).toBe(true)
    })

    it('rejects a tiny route even when distance is unknown', () => {
      const route = [
        { lat: 10, lng: 10 },
        { lat: 10.00001, lng: 10.00001 },
      ]
      expect(validateRoute(route)).toBe(false)
    })
  })
})

describe('computeFitScale', () => {
  it('fits a portrait card into a small area by the limiting dimension', () => {
    // area 400x600, card 1080x1920 -> min(400/1080, 600/1920) = min(0.370, 0.3125)
    expect(computeFitScale({ w: 400, h: 600 }, { w: 1080, h: 1920 })).toBeCloseTo(0.3125, 4)
  })

  it('is limited by width when the area is wide and short', () => {
    // area 1000x200, card 1080x1080 -> min(0.9259, 0.1852) = 0.1852
    expect(computeFitScale({ w: 1000, h: 200 }, { w: 1080, h: 1080 })).toBeCloseTo(0.18518, 4)
  })

  it('returns 1 for non-positive card dimensions', () => {
    expect(computeFitScale({ w: 400, h: 600 }, { w: 0, h: 0 })).toBe(1)
  })
})
