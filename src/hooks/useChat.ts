import { useCallback, useEffect, useRef, useState } from 'react'
import type { Chess } from 'chess.js'
import { detectChatIntent, explainMove, stockfishChessReply } from '../lib/chat'
import { createEngineContext, engineContextPrompt } from '../lib/chess'
import type { ChatStatus, EngineLine, Mode } from '../types/chess'

export type ChatMessage = { role: 'assistant' | 'user'; text: string }

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  text: "Hey, I'm ChessMind. Ask me anything, or ask about this position. I can explore moves with Stockfish while we talk.",
}

type UseChatOptions = {
  contextKey: string
  getGame: () => Chess
  getEngineLine: () => EngineLine
  getMode: () => Mode
  getHumanColor: () => 'w' | 'b'
}

export function useChat({ contextKey, getGame, getEngineLine, getMode, getHumanColor }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<ChatStatus>('checking')
  const [thinking, setThinking] = useState(false)
  const inFlightRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const modelReadyRef = useRef(false)
  const requestIdRef = useRef(0)
  const contextKeyRef = useRef(contextKey)
  const valuesRef = useRef({ getGame, getEngineLine, getMode, getHumanColor })
  contextKeyRef.current = contextKey
  valuesRef.current = { getGame, getEngineLine, getMode, getHumanColor }

  const invalidateForContextChange = useCallback(() => {
    if (!inFlightRef.current) return
    requestIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    inFlightRef.current = false
    setThinking(false)
    setStatus(modelReadyRef.current ? 'ready' : 'offline')
    setMessages((current) => [...current, { role: 'assistant', text: 'The chess context changed, so I stopped the previous chat request. Ask again to get an answer for the current game state.' }])
  }, [])

  useEffect(() => {
    let cancelled = false
    let retryTimer: number | undefined
    let checkController: AbortController | null = null
    const checkModel = async () => {
      if (!inFlightRef.current) setStatus('checking')
      checkController = new AbortController()
      const timeout = window.setTimeout(() => checkController?.abort(), 3000)
      try {
        const response = await fetch('/api/ollama/api/tags', { signal: checkController.signal })
        if (!response.ok) throw new Error(`Ollama returned ${response.status}`)
        const result = await response.json() as { models?: { name: string }[] }
        const available = result.models?.some((model) => model.name === 'qwen3:1.7b' || model.name.startsWith('qwen3:1.7b-')) ?? false
        modelReadyRef.current = available
        if (!cancelled) {
          if (!inFlightRef.current) setStatus(available ? 'ready' : 'offline')
          if (!available) retryTimer = window.setTimeout(() => { void checkModel() }, 4000)
        }
      } catch {
        modelReadyRef.current = false
        if (!cancelled) {
          if (!inFlightRef.current) setStatus('offline')
          retryTimer = window.setTimeout(() => { void checkModel() }, 4000)
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void checkModel()
    return () => {
      cancelled = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      checkController?.abort()
    }
  }, [])

  useEffect(() => {
    invalidateForContextChange()
  }, [contextKey, invalidateForContextChange])

  useEffect(() => () => {
    requestIdRef.current += 1
    abortRef.current?.abort()
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
  }, [])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || inFlightRef.current) return
    const requestId = ++requestIdRef.current
    const requestContextKey = contextKeyRef.current
    const { getGame: readGame, getEngineLine: readLine, getMode: readMode, getHumanColor: readColor } = valuesRef.current
    const game = readGame()
    const mode = readMode()
    const context = createEngineContext(game, mode, readLine())
    const requestFen = context.fen
    const history = game.history()
    const isChessQuestion = detectChatIntent(trimmed) !== 'general' || /\b(chess|fen|pgn|stockfish|pawn|king|queen|rook|bishop|knight|variation|tactic|blunder|board|last move|my move|whose turn|your turn|my turn|legal move)\b/i.test(trimmed)
    setMessages((current) => [...current, { role: 'user', text: trimmed }])
    setDraft('')
    if (isChessQuestion) {
      setMessages((current) => [...current, { role: 'assistant', text: stockfishChessReply(trimmed, game, context, mode, readColor()) }])
      return
    }

    inFlightRef.current = true
    setThinking(true)
    setStatus('thinking')
    const controller = new AbortController()
    abortRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 120_000)
    timeoutRef.current = timeout
    const requestMessages = [...messages.slice(-12).map((message) => ({ role: message.role, content: message.text })), { role: 'user', content: trimmed }]
    const systemPrompt = `You are ChessMind, a friendly and thoughtful assistant. The user may discuss any subject, not just chess. Answer unrelated questions naturally without steering them back to chess. For chess questions about the current position, prioritize the supplied Stockfish result and never invent an evaluation, best move, or variation. State clearly when engine data is unavailable.\n\n${engineContextPrompt(context, history)}`
    try {
      const response = await fetch('/api/ollama/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ model: 'qwen3:1.7b', stream: false, think: false, options: { temperature: 0.7, num_ctx: 4096, num_predict: 350 }, messages: [{ role: 'system', content: systemPrompt }, ...requestMessages] }),
      })
      if (!response.ok) throw new Error(`Local model request failed (${response.status})`)
      const result = await response.json() as { message?: { content?: string } }
      const reply = (result.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      if (!reply) throw new Error('Local model returned an empty response')
      if (requestId !== requestIdRef.current) return
      if (requestContextKey !== contextKeyRef.current || requestFen !== readGame().fen()) {
        invalidateForContextChange()
        return
      }
      modelReadyRef.current = true
      setStatus('ready')
      setMessages((current) => [...current, { role: 'assistant', text: reply }])
    } catch (error) {
      if (requestId === requestIdRef.current) {
        if (requestContextKey !== contextKeyRef.current || requestFen !== readGame().fen()) {
          invalidateForContextChange()
          return
        }
        modelReadyRef.current = false
        setStatus('offline')
        const fallback = isChessQuestion
          ? explainMove(trimmed, game, context, mode)
          : 'This question is unrelated to the board, so I will not guess an answer from chess data. Start Ollama and send it again for a general response.'
        const reason = controller.signal.aborted
          ? 'The local chat request timed out.'
          : error instanceof Error && error.message.startsWith('Local model request failed')
            ? `${error.message}.`
            : error instanceof Error && error.message.startsWith('Local model returned')
              ? `${error.message}.`
              : error instanceof SyntaxError
                ? 'The local model returned invalid JSON.'
            : 'I can’t reach the local chat model right now. Please make sure Ollama is running.'
        setMessages((current) => [...current, { role: 'assistant', text: `${reason} ${fallback}` }])
      }
    } finally {
      window.clearTimeout(timeout)
      if (timeoutRef.current === timeout) timeoutRef.current = null
      if (requestId === requestIdRef.current) {
        abortRef.current = null
        inFlightRef.current = false
        setThinking(false)
      }
    }
  }, [invalidateForContextChange, messages])

  const cancel = useCallback(() => {
    requestIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    inFlightRef.current = false
    setThinking(false)
    setStatus(modelReadyRef.current ? 'ready' : 'offline')
  }, [])

  const reset = useCallback(() => {
    cancel()
    setMessages([INITIAL_MESSAGE])
  }, [cancel])

  const addAssistantMessage = useCallback((text: string) => {
    setMessages((current) => [...current, { role: 'assistant', text }])
  }, [])

  return { messages, draft, status, thinking, setDraft, send, reset, cancel, addAssistantMessage }
}
