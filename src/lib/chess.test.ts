import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { createEngineContext, materialBalance, positionLabel } from './chess'
import { EMPTY_ENGINE_LINE } from '../types/chess'

describe('chess helpers', () => {
  it('reports legal game state and computes material with chess.js positions', () => {
    const game = new Chess()
    expect(positionLabel(game)).toBe('White to move.')
    expect(materialBalance(game)).toBe(0)
    game.move('e4')
    expect(positionLabel(game)).toBe('Black to move.')
  })

  it('does not invent engine values in context before a search completes', () => {
    const game = new Chess()
    expect(createEngineContext(game, 'analysis', EMPTY_ENGINE_LINE)).toMatchObject({
      fen: game.fen(),
      evaluation: null,
      bestMove: null,
      principalVariation: [],
    })
  })

  it('discards a real engine result when it belongs to a different FEN', () => {
    const game = new Chess()
    const context = createEngineContext(game, 'analysis', {
      score: 420,
      mate: null,
      depth: 20,
      bestMove: 'e4',
      bestUci: 'e2e4',
      line: ['e4'],
      fen: 'different-position',
    })
    expect(context).toMatchObject({ evaluation: null, bestMove: null, depth: 0 })
  })
})
