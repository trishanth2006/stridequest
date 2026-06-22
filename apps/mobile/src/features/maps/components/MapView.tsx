import { StyleSheet } from 'react-native'
import MapboxGL from '@rnmapbox/maps'

type Props = {
  style?: object
  children?: React.ReactNode
  interactive?: boolean
}

export function MapView({ style, children, interactive = true }: Props) {
  return (
    <MapboxGL.MapView
      style={style ?? styles.fill}
      styleURL={MapboxGL.StyleURL.Dark}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      pitchEnabled={interactive}
      rotateEnabled={interactive}
    >
      {children}
    </MapboxGL.MapView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
