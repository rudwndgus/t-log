import { Bike, BusFront, Car, Footprints, Plane, TrainFront, type LucideIcon } from 'lucide-react'
import type { TransportMode } from '../../types'

export type SelectableTransportMode = 'walk' | 'driving' | 'cycling' | 'bus' | 'train' | 'plane'

export const transportModeOptions: Array<{ value: SelectableTransportMode; label: string; Icon: LucideIcon }> = [
  { value: 'walk', label: '도보', Icon: Footprints },
  { value: 'driving', label: '자동차', Icon: Car },
  { value: 'cycling', label: '자전거', Icon: Bike },
  { value: 'bus', label: '버스', Icon: BusFront },
  { value: 'train', label: '기차', Icon: TrainFront },
  { value: 'plane', label: '비행기', Icon: Plane },
]

export const selectableTransportMode = (mode?: TransportMode): SelectableTransportMode => {
  if (mode === 'driving' || mode === 'cycling' || mode === 'bus' || mode === 'train' || mode === 'plane') return mode
  if (mode === 'transit' || mode === 'shuttle') return 'bus'
  if (mode === 'ferry') return 'train'
  return 'walk'
}

export const transportModeOption = (mode?: TransportMode) => {
  const selected = selectableTransportMode(mode)
  return transportModeOptions.find((candidate) => candidate.value === selected) || transportModeOptions[0]
}
