import { act, renderHook, waitFor } from '@testing-library/react'
import { Chess } from 'chess.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_ENGINE_LINE } from '../types/chess'
import { useChat } from './useChat'

afterEach(() => {
  vi.unstubAllGlobals()
})

function chatOptions(fen = new Chess().fen()) {
  const game = new Chess(fen)
  return {
    fen,
    getGame: () => game,
    getEngineLine: () => EMPTY_ENGINE_LINE,
    getMode: () => 'analysis' as const,
    getHumanColor: () => 'w' as const,
  }
}

describe('useChat', () => {
  it('checks local model availability and sends a natural-language message', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: { content: 'Hello from the local model.' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useChat(chatOptions()))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => result.current.send('Hello'))
    expect(result.current.messages.at(-1)?.text).toBe('Hello from the local model.')
    expect(result.current.thinking).toBe(false)
  })

  it('answers brilliant-move questions from chess logic without making a model request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useChat(chatOptions()))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => result.current.send('Is there a brilliant move?'))
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result.current.messages.at(-1)?.text).toContain('Run Game Review')
    expect(result.current.messages.at(-1)?.text).toContain('does not have a completed evaluation')
  })

  it('aborts a response when its associated board position changes', async () => {
    let requestSignal: AbortSignal | undefined
    let resolveChat: ((response: Response) => void) | undefined
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/api/tags')) {
        return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }))
      }
      requestSignal = init?.signal as AbortSignal
      return new Promise<Response>((resolve) => { resolveChat = resolve })
    })
    vi.stubGlobal('fetch', fetchMock)
    const firstFen = new Chess().fen()
    const { result, rerender } = renderHook(({ options }) => useChat(options), { initialProps: { options: chatOptions(firstFen) } })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => { void result.current.send('Tell me a story') })
    await waitFor(() => expect(result.current.thinking).toBe(true))
    const nextGame = new Chess()
    nextGame.move('e4')
    rerender({ options: chatOptions(nextGame.fen()) })
    await waitFor(() => expect(result.current.thinking).toBe(false))
    expect(requestSignal?.aborted).toBe(true)
    await act(async () => {
      resolveChat?.(new Response(JSON.stringify({ message: { content: 'Stale answer.' } }), { status: 200 }))
    })
    expect(result.current.messages.some((message) => message.text === 'Stale answer.')).toBe(false)
    expect(result.current.messages.at(-1)?.text).toContain('The board changed')
  })
})
