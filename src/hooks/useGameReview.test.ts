import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EngineLine, ReviewPosition } from '../types/chess'
import { useGameReview } from './useGameReview'

const positions: ReviewPosition[] = [
  { ply: 0, fen: 'start', positionCommand: 'position startpos', move: null },
  { ply: 1, fen: 'white-move', positionCommand: 'position after white', move: { san: 'e4', color: 'w', materialBefore: 0, materialAfter: 0 } },
  { ply: 2, fen: 'black-move', positionCommand: 'position after black', move: { san: 'e5', color: 'b', materialBefore: 0, materialAfter: 0 } },
]

function engineLine(fen: string, score: number): EngineLine {
  return { fen, score, mate: null, depth: 12, bestMove: '', bestUci: '', line: [] }
}

describe('useGameReview', () => {
  it('analyzes each timeline position and scores losses from the mover perspective', async () => {
    const analyze = vi.fn()
      .mockResolvedValueOnce(engineLine('start', 100))
      .mockResolvedValueOnce(engineLine('white-move', -200))
      .mockResolvedValueOnce(engineLine('black-move', 50))
    const recordEvaluation = vi.fn()
    const { result } = renderHook(() => useGameReview({
      getPositions: () => positions,
      analyze,
      stopAnalysis: vi.fn(),
      reanalyzeCurrent: vi.fn(),
      recordEvaluation,
      engineReady: true,
      depth: 18,
    }))
    await act(async () => result.current.start())
    await waitFor(() => expect(result.current.progress).toBeNull())
    expect(result.current.reviewedMoves.map((move) => move.classification)).toEqual(['Blunder', 'Mistake'])
    expect(result.current.reviewedMoves.map((move) => move.centipawnLoss)).toEqual([300, 250])
    expect(recordEvaluation).toHaveBeenCalledTimes(3)
    expect(result.current.summary).toBe('+0.50')
  })

  it('does not publish results from a cancelled review run', async () => {
    let resolveAnalysis: ((line: EngineLine) => void) | undefined
    const analyze = vi.fn(() => new Promise<EngineLine>((resolve) => { resolveAnalysis = resolve }))
    const reanalyzeCurrent = vi.fn()
    const { result } = renderHook(() => useGameReview({
      getPositions: () => positions,
      analyze,
      stopAnalysis: vi.fn(),
      reanalyzeCurrent,
      recordEvaluation: vi.fn(),
      engineReady: true,
      depth: 12,
    }))
    act(() => { void result.current.start() })
    await waitFor(() => expect(analyze).toHaveBeenCalledOnce())
    act(() => result.current.invalidate())
    await act(async () => resolveAnalysis?.(engineLine('start', 200)))
    expect(result.current.progress).toBeNull()
    expect(result.current.reviewedMoves).toEqual([])
    expect(reanalyzeCurrent).not.toHaveBeenCalled()
  })
})
