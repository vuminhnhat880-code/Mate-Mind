import { act, renderHook, waitFor } from '@testing-library/react'
import { Chess } from 'chess.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_ENGINE_LINE, type EngineLine, type Mode } from '../types/chess'
import { useChat } from './useChat'

afterEach(() => {
  vi.unstubAllGlobals()
})

function chatOptions(
  fen = new Chess().fen(),
  options: { mode?: Mode; humanColor?: 'w' | 'b'; engineLine?: EngineLine; history?: string[] } = {},
) {
  const game = new Chess(fen)
  for (const move of options.history ?? []) game.move(move)
  const mode = options.mode ?? 'analysis'
  const humanColor = options.humanColor ?? 'w'
  const engineLine = options.engineLine ?? EMPTY_ENGINE_LINE
  return {
    contextKey: JSON.stringify([fen, game.history(), mode, humanColor, engineLine.fen, engineLine.score, engineLine.mate, engineLine.depth, engineLine.bestMove, engineLine.line]),
    getGame: () => game,
    getEngineLine: () => engineLine,
    getMode: () => mode,
    getHumanColor: () => humanColor,
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
    expect(result.current.messages.at(-1)?.text).toContain('The chess context changed')
  })

  it.each([
    ['mode', (fen: string) => chatOptions(fen, { mode: 'play' })],
    ['human color', (fen: string) => chatOptions(fen, { humanColor: 'b' })],
    ['engine result', (fen: string) => chatOptions(fen, { engineLine: { ...EMPTY_ENGINE_LINE, fen, score: 125, depth: 12, bestMove: 'e4', line: ['e4'] } })],
  ])('rejects a late response when the unchanged-FEN %s context changes', async (_name, createNextOptions) => {
    let resolveChat: ((response: Response) => void) | undefined
    let requestSignal: AbortSignal | undefined
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/api/tags')) {
        return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }))
      }
      requestSignal = init?.signal as AbortSignal
      return new Promise<Response>((resolve) => { resolveChat = resolve })
    })
    vi.stubGlobal('fetch', fetchMock)
    const fen = new Chess().fen()
    const { result, rerender } = renderHook(({ options }) => useChat(options), { initialProps: { options: chatOptions(fen) } })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => { void result.current.send('Tell me a story') })
    await waitFor(() => expect(result.current.thinking).toBe(true))

    rerender({ options: createNextOptions(fen) })
    await waitFor(() => expect(result.current.thinking).toBe(false))
    expect(requestSignal?.aborted).toBe(true)
    await act(async () => {
      resolveChat?.(new Response(JSON.stringify({ message: { content: 'Outdated context answer.' } }), { status: 200 }))
    })
    expect(result.current.messages.some((message) => message.text === 'Outdated context answer.')).toBe(false)
    expect(result.current.messages.at(-1)?.text).toContain('The chess context changed')
  })

  it('aborts a pending reply on reset and keeps its late response out of the new conversation', async () => {
    let resolveChat: ((response: Response) => void) | undefined
    let requestSignal: AbortSignal | undefined
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/api/tags')) {
        return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }))
      }
      requestSignal = init?.signal as AbortSignal
      return new Promise<Response>((resolve) => { resolveChat = resolve })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useChat(chatOptions()))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => { void result.current.send('Tell me a story') })
    await waitFor(() => expect(result.current.thinking).toBe(true))

    act(() => result.current.reset())
    expect(requestSignal?.aborted).toBe(true)
    expect(result.current.thinking).toBe(false)
    expect(result.current.messages).toHaveLength(1)
    await act(async () => {
      resolveChat?.(new Response(JSON.stringify({ message: { content: 'Old conversation reply.' } }), { status: 200 }))
    })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]?.text).toContain("Hey, I'm Stockbot")
  })

  it.each([
    [JSON.stringify({ message: { content: '  ' } }), 'empty response'],
    ['{malformed JSON', 'invalid JSON'],
  ])('surfaces malformed model output and exits thinking (%s)', async (body, expectedError) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useChat(chatOptions()))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => result.current.send('Tell me a story'))

    expect(result.current.thinking).toBe(false)
    expect(result.current.status).toBe('offline')
    expect(result.current.messages.at(-1)?.text).toContain(expectedError)
  })
})
