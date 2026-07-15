import { supabase } from '@/lib/supabase'
import { cellsToFeatureCollection } from '@stridequest/shared/territory'
import type { TerritoryCollection, TerritoryFetchOptions } from '../types'

const EMPTY: TerritoryCollection = { type: 'FeatureCollection', features: [] }

export async function fetchTerritory(options: TerritoryFetchOptions): Promise<TerritoryCollection> {
  if (options.scope === 'me') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return EMPTY

    const { data, error } = await supabase
      .from('cell_ownership')
      .select('cell_id')
      .eq('owner_user_id', user.id)
      .limit(5000)

    if (error || !data) return EMPTY
    const cellIds = (data as { cell_id: string }[]).map((row) => row.cell_id)
    return cellsToFeatureCollection(cellIds) as TerritoryCollection
  }

  return EMPTY
}
