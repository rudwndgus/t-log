import { describe, expect, it } from 'vitest'
import { dayLabel, inviteCode, tripDayCount } from './utils'

describe('travel date helpers', () => {
  it('counts both start and end dates', () => expect(tripDayCount('2026-09-04', '2026-09-07')).toBe(4))
  it('creates a readable day label', () => expect(dayLabel('2026-09-04', 1)).toContain('Day 2'))
  it('creates a six-character share code', () => expect(inviteCode()).toMatch(/^[A-Z0-9]{6}$/))
})
