import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

class ScriptedWorker {
  static instance: ScriptedWorker
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  private engineMoves = ['e7e5', 'd8h4']

  constructor() {
    ScriptedWorker.instance = this
  }

  postMessage(message: string) {
    if (message === 'uci') this.emit('uciok')
    else if (message === 'isready') this.emit('readyok')
    else if (message.startsWith('go ')) {
      const move = message.startsWith('go movetime') ? this.engineMoves.shift() ?? '(none)' : 'e2e4'
      this.emit(`info depth 1 score cp 10 pv ${move}`)
      this.emit(`bestmove ${move}`)
    }
  }

  terminate() {}

  private emit(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>)
  }
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
})
