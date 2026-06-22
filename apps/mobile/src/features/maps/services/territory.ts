import { supabase } from '@/lib/supabase'
import { cellsToFeatureCollection } from '@stridequest/shared/territory'
import type { TerritoryCollection, TerritoryFetchOptions } from '../types'

const EMPTY: TerritoryCollection = { type: 'FeatureCollection', features: [] }

export async function fetchTerritory(options: TerritoryFetchOptions): Promise<TerritoryCollection> {
  if (options.scope === 'me') {
    const { data, error } = await supabase
      .from('cell_ownership')
      .select('cell_id')
      .limit(5000)

    if (error || !data) return EMPTY
    const cellIds = (data as { cell_id: string }[]).map((row) => row.cell_id)
    return cellsToFeatureCollection(cellIds) as TerritoryCollection
  }

  return EMPTY
}
