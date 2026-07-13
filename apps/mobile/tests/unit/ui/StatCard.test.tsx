import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { StatCard } from '@/components/ui/StatCard'
import { SectionLabel } from '@/components/ui/SectionLabel'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

describe('StatCard', () => {
  it('renders value and label', async () => {
    await render(<StatCard label="Distance" value="42.2 km" icon="navigate" />)
    expect(screen.getByText('42.2 km')).toBeTruthy()
    expect(screen.getByText('Distance')).toBeTruthy()
  })

  it('renders the optional footer line', async () => {
    await render(
      <StatCard label="Territory" value="9" icon="map" footer="5 captured · 2 stolen" />,
    )
    expect(screen.getByText('5 captured · 2 stolen')).toBeTruthy()
  })

  it('renders accent variant without crashing', async () => {
    await render(<StatCard label="Total XP" value="1,200" icon="flash" accent />)
    expect(screen.getByText('1,200')).toBeTruthy()
  })
})

describe('SectionLabel', () => {
  it('renders its children', async () => {
    await render(<SectionLabel>Personal Records</SectionLabel>)
    expect(screen.getByText('Personal Records')).toBeTruthy()
  })
})
