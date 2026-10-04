import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { Chess, type Square } from 'chess.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

class ScriptedWorker {
  static instance: ScriptedWorker
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  posted: string[] = []
  private engineMoves = ['e7e5', 'd8h4']
  private position = 'position startpos'

  constructor() {
    ScriptedWorker.instance = this
  }

  postMessage(message: string) {
    this.posted.push(message)
    if (message === 'uci') this.emit('uciok')
    else if (message === 'isready') this.emit('readyok')
    else if (message.startsWith('position ')) this.position = message
    else if (message.startsWith('go ')) {
      const move = message.startsWith('go movetime')
        ? this.engineMoves.shift() ?? '(none)'
        : this.position.includes(' moves ') ? 'e7e5' : 'e2e4'
      this.emit(`info depth 1 score cp 10 pv ${move}`)
      this.emit(`bestmove ${move}`)
    }
  }

  terminate() {}

  private emit(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>)
  }
}

class DeferredWorker {
  static instance: DeferredWorker
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  position = 'position startpos'
  searchCount = 0

  constructor() {
    DeferredWorker.instance = this
  }

  postMessage(message: string) {
    if (message === 'uci') this.emit('uciok')
    else if (message === 'isready') this.emit('readyok')
    else if (message.startsWith('position ')) this.position = message
    else if (message.startsWith('go ')) this.searchCount += 1
  }

  terminate() {}

  completeSearch() {
    const game = new Chess()
    if (this.position.startsWith('position fen ')) {
      const command = this.position.slice('position fen '.length)
      const [fen, moveText] = command.split(' moves ')
      if (!fen) throw new Error(`Invalid deferred position command: ${this.position}`)
      game.load(fen)
      for (const uci of moveText?.split(/\s+/) ?? []) {
        game.move({
          from: uci.slice(0, 2) as Square,
          to: uci.slice(2, 4) as Square,
          ...(uci[4] ? { promotion: uci[4] as 'q' | 'r' | 'b' | 'n' } : {}),
        })
      }
    } else if (this.position.startsWith('position startpos moves ')) {
      const moves = this.position.slice('position startpos moves '.length).split(/\s+/)
      for (const uci of moves) {
        game.move({
          from: uci.slice(0, 2) as Square,
          to: uci.slice(2, 4) as Square,
          ...(uci[4] ? { promotion: uci[4] as 'q' | 'r' | 'b' | 'n' } : {}),
        })
      }
    }
    const move = game.moves({ verbose: true })[0]
    if (!move) throw new Error(`No legal move available for deferred search: ${this.position}`)
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`
    this.emit(`info depth 12 score cp 10 pv ${uci}`)
    this.emit(`bestmove ${uci}`)
  }

  private emit(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>)
  }
}

const promotionPgn = '[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K b - - 0 1"]\n\n1... Kg7 2. a8=Q'

async function openPromotionWhileReviewing() {
  vi.stubGlobal('Worker', DeferredWorker)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }),
  ))
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const ui = render(<App />)
  const worker = await waitFor(() => {
    expect(DeferredWorker.instance).toBeDefined()
    return DeferredWorker.instance
  })
  await waitFor(() => expect(worker.searchCount).toBe(1))

  fireEvent.click(ui.getByRole('button', { name: 'Import' }))
  fireEvent.click(ui.getByRole('tab', { name: 'PGN game' }))
  fireEvent.change(ui.getByLabelText('Paste PGN'), { target: { value: promotionPgn } })
  fireEvent.click(ui.getByRole('button', { name: 'Load PGN' }))
  act(() => worker.completeSearch())
  await waitFor(() => expect(worker.searchCount).toBe(2))
  act(() => worker.completeSearch())

  fireEvent.click(ui.getByRole('button', { name: 'Undo move' }))
  await waitFor(() => expect(worker.searchCount).toBe(3))
  fireEvent.click(ui.getByRole('button', { name: 'Review' }))
  act(() => worker.completeSearch())
  await waitFor(() => expect(worker.searchCount).toBe(4))
  await waitFor(() => expect(ui.getByRole('status').textContent).toContain('Reviewing 0 / 2 positions'))
  fireEvent.click(ui.getByLabelText('a7 white p'))
  fireEvent.click(ui.getByLabelText(/^a8 empty/))
  expect(ui.getByRole('dialog', { name: 'Choose a piece' })).toBeTruthy()
  return { ...ui, worker }
}

describe('App game controls', () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScrollIntoView })
    vi.unstubAllGlobals()
  })

  it('does not allow resignation to replace a completed checkmate result', async () => {
    vi.stubGlobal('Worker', ScriptedWorker)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }),
    ))
    const { getByLabelText, getByRole, findByText } = render(<App />)

    fireEvent.click(getByLabelText('f2 white p'))
    fireEvent.click(getByLabelText(/^f3 empty/))
    await waitFor(() => expect(getByLabelText('e5 black p')).toBeTruthy())
    fireEvent.click(getByLabelText('g2 white p'))
    fireEvent.click(getByLabelText(/^g4 empty/))
    await findByText('Checkmate')

    const resign = getByRole('button', { name: 'Resign' }) as HTMLButtonElement
    expect(resign.disabled).toBe(true)
    expect(getByRole('status').textContent).toContain('Checkmate')
  })

  it('does not run a delayed black opening move after switching to Analysis', async () => {
    vi.stubGlobal('Worker', ScriptedWorker)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }),
    ))
    const { getByLabelText, getByRole } = render(<App />)
    await waitFor(() => expect(ScriptedWorker.instance.posted).toContain('isready'))
    fireEvent.change(getByLabelText('Choose your side'), { target: { value: 'b' } })
    fireEvent.click(getByRole('button', { name: /Analysis/ }))
    await new Promise((resolve) => window.setTimeout(resolve, 150))
    expect(ScriptedWorker.instance.posted.some((message) => message.startsWith('go movetime'))).toBe(false)
  })

  it('clears completed review results when navigating to another position', async () => {
    vi.stubGlobal('Worker', ScriptedWorker)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }),
    ))
    const { getByLabelText, getByRole, queryByText, findByText } = render(<App />)

    fireEvent.click(getByRole('button', { name: /Analysis/ }))
    fireEvent.click(getByLabelText('e2 white p'))
    fireEvent.click(getByLabelText(/^e4 empty/))
    await waitFor(() => expect(getByLabelText('e4 white p')).toBeTruthy())
    fireEvent.click(getByRole('button', { name: 'Review' }))
    await findByText('Final position:')

    fireEvent.click(getByRole('button', { name: 'Undo move' }))

    expect(queryByText('Final position:')).toBeNull()
    expect(queryByText('Move-by-move review')).toBeNull()
  })

  it('preserves an active review when promotion is cancelled', async () => {
    const { getByRole, getByLabelText, queryByRole } = await openPromotionWhileReviewing()
    fireEvent.click(getByRole('button', { name: 'Cancel promotion' }))
    expect(queryByRole('dialog', { name: 'Choose a piece' })).toBeNull()
    expect(getByLabelText('a7 white p')).toBeTruthy()
    expect(getByRole('status').textContent).toContain('Reviewing 0 / 2 positions')
  })

  it('clears the old review after confirming a promotion branch', async () => {
    const { getByRole, getByLabelText, queryByRole, queryByText } = await openPromotionWhileReviewing()
    fireEvent.click(getByRole('button', { name: 'Nữ hoàng (Queen)' }))
    expect(getByLabelText('a8 white q')).toBeTruthy()
    expect(queryByRole('status')).toBeNull()
    expect(queryByText('Final position:')).toBeNull()
  })
})
