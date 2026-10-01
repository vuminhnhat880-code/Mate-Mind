import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { classifyMove, enginePositionCommand, formatEvaluation, parsePrincipalVariation, parseUciInfo, readEngineSettings, reviewEvaluationScore } from './stockfish'

describe('Stockfish helpers', () => {
  it('parses centipawn and mate scores from the engine side-to-move perspective', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const white = parseUciInfo(start, 'info depth 18 multipv 1 score cp 142 nodes 100 pv e2e4 e7e5')
    expect(white).toMatchObject({ score: 142, rank: 1, depth: 18, bestMove: 'e4' })
    const blackToMove = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1'
    expect(parseUciInfo(blackToMove, 'info depth 20 score mate 3 pv e7e5 e2e4')?.mate).toBe(-3)
    expect(parseUciInfo(start, 'info depth 10 score cp 90 lowerbound pv e2e4')).toBeNull()
  })

  it('parses legal SAN PV, formats signed evaluation, and applies clear loss thresholds', () => {
    expect(parsePrincipalVariation('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e2e4', 'e7e5'])).toEqual(['e4', 'e5'])
    expect(formatEvaluation(142, null)).toBe('+1.42')
    expect(formatEvaluation(null, -2)).toBe('M-2')
    expect(classifyMove(4)).toBe('Best')
    expect(classifyMove(50)).toBe('Good')
    expect(classifyMove(300)).toBe('Blunder')
    expect(classifyMove(5, 400)).toBe('Best')
    expect(classifyMove(5, -400, { moverBefore: 40, moverAfter: 180 })).toBe('Brilliant')
    expect(classifyMove(5, -400, { moverBefore: 350, moverAfter: 500 })).toBe('Best')
    expect(classifyMove(5, -400, { moverBefore: 40, moverAfter: 90 })).toBe('Best')
    expect(classifyMove(5, -400, { moverBefore: -500, moverAfter: 180 })).toBe('Best')
  })

  it('converts engine and mate evaluations to bounded white-perspective review scores', () => {
    expect(reviewEvaluationScore(125, null)).toBe(125)
    expect(reviewEvaluationScore(null, 3)).toBe(9970)
    expect(reviewEvaluationScore(null, -3)).toBe(-9970)
    expect(reviewEvaluationScore(null, 250)).toBe(9000)
    expect(reviewEvaluationScore(null, 0)).toBe(0)
    expect(reviewEvaluationScore(null, null)).toBeNull()
  })

  it('bounds persisted settings and falls back safely on corrupted storage', () => {
    const storage = { getItem: () => '{"depth":1000,"threads":0,"multiPv":4}' }
    expect(readEngineSettings(storage, 8)).toMatchObject({ depth: 40, threads: 1, multiPv: 1 })
    expect(readEngineSettings({ getItem: () => '{broken' }, 6).threads).toBe(6)
  })

  it('serializes legal move history into the worker position command', () => {
    const game = new Chess()
    game.move('e4')
    game.move('e5')
    expect(enginePositionCommand(game, new Chess().fen())).toBe('position startpos moves e2e4 e7e5')
  })
})
