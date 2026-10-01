import { describe, expect, it } from 'vitest'
import { detectOpening, matchOpening } from './openings'

describe('detectOpening', () => {
  it('matches the longest known sequence and supplies generic families', () => {
    expect(detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])).toBe('Ruy Lopez')
    expect(detectOpening(['e4', 'e5'])).toBe("King's Pawn Opening")
    expect(detectOpening(['d4'])).toBe("Queen's Pawn Game")
    expect(matchOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])).toMatchObject({ eco: 'C60', name: 'Ruy Lopez' })
  })
})
