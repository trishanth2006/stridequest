import { render } from '@testing-library/react'
import { WorkoutRouteReplay } from '@/features/running/components/WorkoutRouteReplay'

// Mock ResizeObserver
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('WorkoutRouteReplay', () => {
  it('renders no GPS data empty state', () => {
    const { getByText } = render(<WorkoutRouteReplay routePoints={[]} territoryCaptures={[]} />)
    expect(getByText('No GPS Data')).toBeTruthy()
  })

  it('renders svg when route points exist', () => {
    const { container } = render(
      <WorkoutRouteReplay 
        routePoints={[{ lat: 10, lng: 20, timestamp: '1', altitude: null }]}
        territoryCaptures={[]} 
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
