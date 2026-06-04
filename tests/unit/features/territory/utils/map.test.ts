import { cellsToGeoJSON, calculateBounds } from '@/features/territory/utils/map'

jest.mock('h3-js', () => ({
  cellToBoundary: jest.fn().mockImplementation((cellId) => {
    // Return a dummy square boundary for testing
    if (cellId === 'cell1') {
      return [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ]
    }
    if (cellId === 'cell2') {
      return [
        [2, 2],
        [3, 2],
        [3, 3],
        [2, 3]
      ]
    }
    return []
  })
}))

describe('Territory map utils', () => {
  describe('cellsToGeoJSON', () => {
    it('returns empty FeatureCollection when cellIds is empty', () => {
      const geojson = cellsToGeoJSON([])
      expect(geojson.type).toBe('FeatureCollection')
      expect(geojson.features).toHaveLength(0)
    })

    it('converts cells to closed polygons', () => {
      const geojson = cellsToGeoJSON(['cell1'])
      expect(geojson.features).toHaveLength(1)
      const feature = geojson.features[0]
      expect(feature.id).toBe('cell1')
      expect(feature.geometry.type).toBe('Polygon')
      
      const coords = feature.geometry.coordinates[0]
      // Ensure it added the closing coordinate
      expect(coords).toHaveLength(5)
      expect(coords[0]).toEqual(coords[coords.length - 1])
    })
  })

  describe('calculateBounds', () => {
    it('returns null for empty cell list', () => {
      expect(calculateBounds([])).toBeNull()
    })

    it('calculates bounding box covering all points of all cells', () => {
      const bounds = calculateBounds(['cell1', 'cell2'])
      // cell1 points: [0,0] to [1,1]
      // cell2 points: [2,2] to [3,3]
      // expected bounds: minLng=0, minLat=0, maxLng=3, maxLat=3
      expect(bounds).toEqual([0, 0, 3, 3])
    })
  })
})
