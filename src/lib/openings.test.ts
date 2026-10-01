import { describe, expect, it } from 'vitest'
import { detectOpening, matchOpening } from './openings'

describe('detectOpening', () => {
  it('matches the longest known sequence and supplies generic families', () => {
    expect(detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])).toBe('Ruy Lopez')
    expect(detectOpening(['e4', 'e5'])).toBe("King's Pawn Opening")
    expect(detectOpening(['d4'])).toBe("Queen's Pawn Game")
    expect(matchOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])).toMatchObject({ eco: 'C60', name: 'Ruy Lopez' })
  })

  it('falls back safely for unknown continuations and returns no false ECO match', () => {
    expect(matchOpening(['h4', 'a5', 'Rh3'])).toBeNull()
    expect(detectOpening(['h4', 'a5', 'Rh3'])).toBe('Unclassified')
    expect(matchOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6'])).toMatchObject({
      eco: 'C68',
      name: 'Ruy Lopez: Exchange Variation',
    })
  })
})
