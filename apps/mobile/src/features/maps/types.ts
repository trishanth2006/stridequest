import type { CellFeatureCollection } from '@stridequest/shared/territory'

export type RoutePoint = {
  lat: number
  lng: number
}

export type TerritoryCollection = CellFeatureCollection

export type TerritoryFetchOptions = { scope: 'me' }
