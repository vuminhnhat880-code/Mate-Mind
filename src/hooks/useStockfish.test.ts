import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStockfish } from './useStockfish'

class MockWorker {
  static instance: MockWorker
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: (() => void) | null = null
  posted: string[] = []
  terminated = false

  constructor() {
    MockWorker.instance = this
  }

  postMessage(message: string) {
    this.posted.push(message)
  }

  terminate() {
    this.terminated = true
  }

  emit(message: string) {
    this.onmessage?.({ data: message } as MessageEvent<string>)
  }
}

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const nextFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('useStockfish', () => {
  it('initializes one worker and applies MultiPV to the search', () => {
    vi.stubGlobal('Worker', MockWorker)
    let currentFen = startFen
    const { result, unmount } = renderHook(() => useStockfish({ getCurrentFen: () => currentFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
      result.current.updateSettings({ multiPv: 3 })
    })
    currentFen = nextFen
    act(() => result.current.analyze(nextFen, 'position startpos moves e2e4'))
    expect(worker.posted).toContain('setoption name MultiPV value 3')
    expect(worker.posted).toContain('go depth 18')
    unmount()
    expect(worker.terminated).toBe(true)
  })

  it('ignores stale analysis and starts only the latest queued search', async () => {
    vi.stubGlobal('Worker', MockWorker)
    let currentFen = startFen
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => currentFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
      result.current.analyze(startFen, 'position startpos')
    })
    currentFen = nextFen
    act(() => result.current.analyze(nextFen, 'position startpos moves e2e4'))
    act(() => worker.emit('info depth 10 score cp 900 pv e2e4'))
    expect(result.current.line.score).toBeNull()
    act(() => worker.emit('bestmove e2e4'))
    await waitFor(() => expect(worker.posted.at(-1)).toBe('go depth 18'))
    expect(worker.posted).toContain('position startpos moves e2e4')
    act(() => {
      worker.emit('info depth 18 multipv 1 score cp 42 pv e7e5')
      worker.emit('bestmove e7e5')
    })
    expect(result.current.line).toMatchObject({ score: -42, bestMove: 'e5', fen: nextFen })
  })

  it('does not play a best move returned for a stale position', () => {
    vi.stubGlobal('Worker', MockWorker)
    const onBestMove = vi.fn()
    let currentFen = startFen
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => currentFen, onBestMove }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
      result.current.playBestMove(startFen, 'position startpos')
    })
    expect(result.current.thinking).toBe(true)
    currentFen = nextFen
    act(() => worker.emit('bestmove e2e4'))
    expect(onBestMove).not.toHaveBeenCalled()
    expect(result.current.thinking).toBe(false)
  })

  it('clears thinking immediately on stop and ignores the stopped search result', () => {
    vi.stubGlobal('Worker', MockWorker)
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => startFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
      result.current.analyze(startFen, 'position startpos')
    })
    expect(result.current.thinking).toBe(true)
    act(() => result.current.stop())
    expect(result.current.thinking).toBe(false)
    expect(worker.posted.at(-1)).toBe('stop')
    act(() => {
      worker.emit('info depth 10 score cp 250 pv e2e4')
      worker.emit('bestmove e2e4')
    })
    expect(result.current.thinking).toBe(false)
    expect(result.current.line.fen).toBeUndefined()
    expect(result.current.error).toBeNull()
  })

  it('clears thinking if the worker fails during a search', () => {
    vi.stubGlobal('Worker', MockWorker)
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => startFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
      result.current.analyze(startFen, 'position startpos')
    })
    expect(result.current.thinking).toBe(true)
    act(() => worker.onerror?.())
    expect(result.current.thinking).toBe(false)
    expect(result.current.error).toMatch(/stopped unexpectedly/i)
  })

  it('ends a malformed bestmove response with a readable error instead of staying busy', () => {
    vi.stubGlobal('Worker', MockWorker)
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => startFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
      result.current.analyze(startFen, 'position startpos')
      worker.emit('bestmove')
    })
    expect(result.current.thinking).toBe(false)
    expect(result.current.error).toMatch(/without a usable evaluation/i)
  })

  it('collects ranked MultiPV candidates and resolves a historical review result', async () => {
    vi.stubGlobal('Worker', MockWorker)
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => startFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
      result.current.updateSettings({ multiPv: 3 })
      result.current.analyze(startFen, 'position startpos')
    })
    act(() => {
      worker.emit('info depth 12 multipv 1 score cp 25 pv e2e4')
      worker.emit('info depth 12 multipv 2 score cp 10 pv d2d4')
      worker.emit('bestmove e2e4')
    })
    expect(result.current.candidates).toHaveLength(2)
    const reviewFen = nextFen
    let completed = null
    const pending = result.current.analyzeAsync(reviewFen, 'position startpos moves e2e4', 12)
    await act(async () => {
      worker.emit('info depth 12 multipv 1 score cp 25 pv e7e5')
      worker.emit('bestmove e7e5')
      completed = await pending
    })
    expect(completed).toMatchObject({ fen: reviewFen, depth: 12, bestMove: 'e5' })
    expect(worker.posted).toContain('setoption name MultiPV value 1')
  })

  it('replaces intermediate queued searches and persists bounded settings', () => {
    vi.stubGlobal('Worker', MockWorker)
    let currentFen = startFen
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => currentFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
      result.current.analyze(startFen, 'position startpos')
    })
    const secondFen = nextFen
    const thirdFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    act(() => {
      currentFen = secondFen
      result.current.analyze(secondFen, 'position second')
      currentFen = thirdFen
      result.current.analyze(thirdFen, 'position third')
    })
    expect(result.current.thinking).toBe(true)
    act(() => worker.emit('bestmove e2e4'))
    expect(worker.posted).toContain('position third')
    expect(worker.posted).not.toContain('position second')
    expect(result.current.thinking).toBe(true)
  })

  it('keeps a stop-and-restart queue isolated from superseded search output', () => {
    vi.stubGlobal('Worker', MockWorker)
    let currentFen = startFen
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => currentFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
      result.current.updateSettings({ multiPv: 2 })
      result.current.analyze(startFen, 'position A')
    })
    const afterMove = nextFen
    act(() => {
      currentFen = afterMove
      result.current.analyze(afterMove, 'position B')
      result.current.stop()
      result.current.analyze(afterMove, 'position C')
    })
    expect(worker.posted).toContain('stop')
    expect(worker.posted).not.toContain('position B')

    act(() => worker.emit('info depth 30 multipv 1 score cp 900 pv e2e4'))
    expect(result.current.line.fen).toBeUndefined()
    expect(result.current.candidates).toEqual([])

    act(() => worker.emit('bestmove e2e4'))
    expect(worker.posted).toContain('position C')
    expect(result.current.thinking).toBe(true)
    act(() => {
      worker.emit('info depth 18 multipv 1 score cp 50 pv e7e5')
      worker.emit('info depth 18 multipv 2 score cp 25 pv d7d5')
    })
    expect(result.current.candidates).toMatchObject([
      { rank: 1, score: -50, depth: 18, bestMove: 'e5' },
      { rank: 2, score: -25, depth: 18, bestMove: 'd5' },
    ])
    act(() => worker.emit('bestmove e7e5'))
    expect(result.current.line).toMatchObject({ fen: afterMove, score: -50, depth: 18, bestMove: 'e5' })
    expect(result.current.thinking).toBe(false)
  })

  it('persists bounded settings', () => {
    vi.stubGlobal('Worker', MockWorker)
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => startFen, onBestMove: vi.fn() }))
    act(() => result.current.updateSettings({ depth: 100, moveTime: 20, multiPv: 5 }))
    expect(result.current.settings).toMatchObject({ depth: 40, moveTime: 250, multiPv: 5 })
    expect(JSON.parse(window.localStorage.getItem('stockbot.engine-settings.v1') ?? '{}')).toMatchObject({ depth: 40, moveTime: 250 })
  })

  it('cancels a historical analysis promise without publishing its result', async () => {
    vi.stubGlobal('Worker', MockWorker)
    const { result } = renderHook(() => useStockfish({ getCurrentFen: () => startFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
    })
    const pending = result.current.analyzeAsync(nextFen, 'position history', 12)
    act(() => result.current.stop())
    let completed: unknown = 'pending'
    await act(async () => {
      completed = await pending
    })
    expect(completed).toBeNull()
    act(() => {
      worker.emit('info depth 12 score cp 300 pv e7e5')
      worker.emit('bestmove e7e5')
    })
    expect(result.current.line.fen).toBeUndefined()
  })

  it('resolves active and queued historical requests when the worker unmounts', async () => {
    vi.stubGlobal('Worker', MockWorker)
    const { result, unmount } = renderHook(() => useStockfish({ getCurrentFen: () => startFen, onBestMove: vi.fn() }))
    const worker = MockWorker.instance
    act(() => {
      worker.emit('uciok')
      worker.emit('readyok')
    })
    const active = result.current.analyzeAsync(startFen, 'position startpos', 12)
    const queued = result.current.analyzeAsync(nextFen, 'position after e4', 12)

    unmount()

    await expect(Promise.all([active, queued])).resolves.toEqual([null, null])
    expect(worker.terminated).toBe(true)
    expect(worker.onmessage).toBeNull()
    expect(worker.onerror).toBeNull()
  })
})
