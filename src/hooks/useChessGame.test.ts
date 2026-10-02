import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useChessGame } from './useChessGame'

describe('useChessGame', () => {
  it('undoes and redoes without losing the imported timeline', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => {
      expect(result.current.importGame('pgn', '1. e4 e5 2. Nf3 Nc6').ok).toBe(true)
    })
    const importedHistory = result.current.history

    act(() => result.current.undo('analysis', 'w'))
    expect(result.current.cursor).toBe(3)
    expect(result.current.history).toEqual(importedHistory)
    expect(result.current.game.fen()).toContain('b')

    act(() => result.current.redo('analysis', 'w'))
    expect(result.current.cursor).toBe(4)
    expect(result.current.history).toEqual(importedHistory)
  })

  it('branches from a navigated position and drops only the abandoned future', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => result.current.importGame('pgn', '1. e4 e5 2. Nf3 Nc6'))
    act(() => result.current.navigateTo(2))
    act(() => result.current.attemptMove('g1', 'f3'))
    expect(result.current.history).toEqual(['e4', 'e5', 'Nf3'])
    expect(result.current.canRedo).toBe(false)
  })

  it('clears redo availability when a new game follows timeline navigation', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => result.current.importGame('pgn', '1. e4 e5 2. Nf3 Nc6'))
    act(() => result.current.undo('analysis', 'w'))
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.newGame())
    expect(result.current.cursor).toBe(0)
    expect(result.current.canRedo).toBe(false)
    act(() => expect(result.current.redo('analysis', 'w')).toBe(false))
  })

  it('validates FEN and preserves the current game on failure', () => {
    const { result } = renderHook(() => useChessGame())
    const before = result.current.fen
    let error: string | undefined
    act(() => {
      const imported = result.current.importGame('fen', 'not a fen')
      if (!imported.ok) error = imported.error
    })
    expect(result.current.fen).toBe(before)
    expect(error).toMatch(/six fields|Invalid FEN/i)
  })

  it('reports invalid PGN without replacing the current move line', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => result.current.attemptMove('e2', 'e4'))
    const beforeFen = result.current.fen
    const beforeHistory = result.current.history
    let error: string | undefined
    act(() => {
      const imported = result.current.importGame('pgn', '1. e5')
      if (!imported.ok) error = imported.error
    })
    expect(error).toMatch(/Invalid PGN/i)
    expect(result.current.fen).toBe(beforeFen)
    expect(result.current.history).toEqual(beforeHistory)
  })

  it('loads PGN setup headers and exposes promotion choices without moving early', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => result.current.importGame('fen', '7k/P7/8/8/8/8/8/7K w - - 0 1'))
    const before = result.current.fen
    act(() => expect(result.current.attemptMove('a7', 'a8')).toBe('promotion'))
    expect(result.current.fen).toBe(before)
    expect(result.current.pendingPromotion).toMatchObject({ from: 'a7', to: 'a8', color: 'w' })
    act(() => result.current.cancelPromotion())
    expect(result.current.fen).toBe(before)
    act(() => result.current.attemptMove('a7', 'a8'))
    act(() => expect(result.current.choosePromotion('n')).toBe(true))
    expect(result.current.game.get('a8')?.type).toBe('n')
  })

  it('loads a PGN with setup/FEN headers from the declared starting position', () => {
    const { result } = renderHook(() => useChessGame())
    let importedHeaders: Record<string, string> | undefined
    act(() => {
      const imported = result.current.importGame('pgn', '[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q')
      if (imported.ok) importedHeaders = imported.headers
    })
    expect(importedHeaders).toMatchObject({ SetUp: '1' })
    expect(result.current.game.get('a8')?.type).toBe('q')
    expect(result.current.getReviewPositions()[0].fen).toContain('7k/P7')
  })

  it('retains PGN headers while navigating the imported move timeline', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => result.current.importGame('pgn', '[Event "Club Match"]\n[Site "Local"]\n\n1. e4 e5'))
    act(() => result.current.undo('analysis', 'w'))
    expect(result.current.game.getHeaders()).toMatchObject({ Event: 'Club Match', Site: 'Local' })
  })

  it('undoes a complete played turn and restores both plies on redo', () => {
    const { result } = renderHook(() => useChessGame())
    act(() => result.current.attemptMove('e2', 'e4'))
    act(() => result.current.attemptMove('e7', 'e5'))
    act(() => result.current.undo('play', 'w'))
    expect(result.current.cursor).toBe(0)
    act(() => result.current.redo('play', 'w'))
    expect(result.current.cursor).toBe(2)
  })
})
