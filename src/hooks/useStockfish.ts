import { useCallback, useEffect, useRef, useState } from 'react'
import type { EngineCandidate, EngineLine, EngineSettings } from '../types/chess'
import { EMPTY_ENGINE_LINE } from '../types/chess'
import { ENGINE_SETTINGS_KEY, parseUciInfo, readEngineSettings } from '../lib/stockfish'

type SearchRequest = {
  id: number
  fen: string
  positionCommand: string
  playMove: boolean
  historical: boolean
  settings: EngineSettings
  bestLine?: EngineLine
  resolve?: (line: EngineLine | null) => void
}

type UseStockfishOptions = {
  getCurrentFen: () => string
  onBestMove: (fen: string, uciMove: string) => void
}

function browserSettings() {
  try {
    return readEngineSettings(
      typeof window === 'undefined' ? undefined : window.localStorage,
      typeof navigator === 'undefined' ? 4 : navigator.hardwareConcurrency || 4,
    )
  } catch {
    return readEngineSettings(undefined, typeof navigator === 'undefined' ? 4 : navigator.hardwareConcurrency || 4)
  }
}

function boundedSetting(value: number, fallback: number, minimum: number, maximum: number) {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.round(value))) : fallback
}

export function useStockfish({ getCurrentFen, onBestMove }: UseStockfishOptions) {
  const workerRef = useRef<Worker | null>(null)
  const readyRef = useRef(false)
  const activeSearchRef = useRef<SearchRequest | null>(null)
  const queuedSearchRef = useRef<SearchRequest | null>(null)
  const stoppingRef = useRef(false)
  const nextRequestIdRef = useRef(0)
  const latestRequestIdRef = useRef(0)
  const currentFenRef = useRef(getCurrentFen)
  const onBestMoveRef = useRef(onBestMove)
  const [initialSettings] = useState(browserSettings)
  const settingsRef = useRef<EngineSettings>(initialSettings)
  const [ready, setReady] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [threads, setThreads] = useState(settingsRef.current.threads)
  const [settings, setSettings] = useState<EngineSettings>(initialSettings)
  const [line, setLine] = useState<EngineLine>(EMPTY_ENGINE_LINE)
  const [candidates, setCandidates] = useState<EngineCandidate[]>([])
  const [error, setError] = useState<string | null>(null)

  currentFenRef.current = getCurrentFen
  onBestMoveRef.current = onBestMove

  const runSearch = useCallback((request: SearchRequest) => {
    const worker = workerRef.current
    if (!worker) {
      request.resolve?.(null)
      return
    }
    if (!request.historical && request.fen !== currentFenRef.current()) {
      request.resolve?.(null)
      return
    }
    latestRequestIdRef.current = request.id
    if (!request.historical) {
      setLine(EMPTY_ENGINE_LINE)
      setCandidates([])
    }
    setError(null)
    if (!readyRef.current) {
      const oldQueued = queuedSearchRef.current
      oldQueued?.resolve?.(null)
      queuedSearchRef.current = request
      return
    }
    if (activeSearchRef.current) {
      const oldQueued = queuedSearchRef.current
      oldQueued?.resolve?.(null)
      queuedSearchRef.current = request
      activeSearchRef.current.resolve?.(null)
      if (!stoppingRef.current) {
        stoppingRef.current = true
        worker.postMessage('stop')
      }
      return
    }
    activeSearchRef.current = request
    stoppingRef.current = false
    setThinking(true)
    worker.postMessage(`setoption name Threads value ${request.settings.threads}`)
    worker.postMessage(`setoption name Hash value ${request.settings.hash}`)
    worker.postMessage(`setoption name MultiPV value ${request.playMove || request.historical ? 1 : request.settings.multiPv}`)
    worker.postMessage('setoption name Ponder value false')
    worker.postMessage(request.positionCommand)
    worker.postMessage(request.playMove ? `go movetime ${request.settings.moveTime}` : `go depth ${request.settings.depth}`)
  }, [])

  const submitSearch = useCallback((fen: string, positionCommand: string, playMove: boolean, resolve?: (line: EngineLine | null) => void, depth?: number, historical = false) => {
    runSearch({
      id: ++nextRequestIdRef.current,
      fen,
      positionCommand,
      playMove,
      historical,
      settings: { ...settingsRef.current, ...(depth === undefined ? {} : { depth: Math.max(8, Math.min(40, Math.round(depth))) }) },
      resolve,
    })
  }, [runSearch])

  const analyze = useCallback((fen: string, positionCommand: string) => {
    submitSearch(fen, positionCommand, false)
  }, [submitSearch])

  const analyzeAsync = useCallback((fen: string, positionCommand: string, depth?: number) => new Promise<EngineLine | null>((resolve) => {
    submitSearch(fen, positionCommand, false, resolve, depth, true)
  }), [submitSearch])

  const playBestMove = useCallback((fen: string, positionCommand: string) => {
    submitSearch(fen, positionCommand, true)
  }, [submitSearch])

  const stop = useCallback(() => {
    const queued = queuedSearchRef.current
    queuedSearchRef.current = null
    queued?.resolve?.(null)
    activeSearchRef.current?.resolve?.(null)
    latestRequestIdRef.current = ++nextRequestIdRef.current
    setThinking(false)
    if (activeSearchRef.current && !stoppingRef.current) {
      stoppingRef.current = true
      workerRef.current?.postMessage('stop')
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<EngineSettings>) => {
    const allowedMultiPv = patch.multiPv === undefined || patch.multiPv === 1 || patch.multiPv === 2 || patch.multiPv === 3 || patch.multiPv === 5
    if (!allowedMultiPv) return
    const next = { ...settingsRef.current, ...patch }
    next.depth = boundedSetting(next.depth, settingsRef.current.depth, 8, 40)
    next.moveTime = boundedSetting(next.moveTime, settingsRef.current.moveTime, 250, 15000)
    next.threads = boundedSetting(next.threads, settingsRef.current.threads, 1, 16)
    next.hash = boundedSetting(next.hash, settingsRef.current.hash, 64, 2048)
    settingsRef.current = next
    setSettings(next)
    setThreads(next.threads)
    try {
      window.localStorage.setItem(ENGINE_SETTINGS_KEY, JSON.stringify(next))
    } catch {
      setError('Engine settings changed for this session but could not be saved in browser storage.')
    }
    stop()
  }, [stop])

  useEffect(() => {
    let worker: Worker
    try {
      worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19.js`)
    } catch (cause) {
      setError(cause instanceof Error ? `Stockfish could not start: ${cause.message}` : 'Stockfish could not start in this browser.')
      return
    }
    workerRef.current = worker
    const startupTimer = window.setTimeout(() => {
      if (!readyRef.current) {
        setError('Stockfish is taking too long to initialize. Check browser support and reload the page.')
        queuedSearchRef.current?.resolve?.(null)
        queuedSearchRef.current = null
        worker.terminate()
        if (workerRef.current === worker) workerRef.current = null
      }
    }, 20_000)
    worker.onmessage = (event: MessageEvent<string>) => {
      const message = String(event.data).trim()
      if (message === 'uciok') {
        const configured = settingsRef.current
        setThreads(configured.threads)
        worker.postMessage(`setoption name Threads value ${configured.threads}`)
        worker.postMessage(`setoption name Hash value ${configured.hash}`)
        worker.postMessage('setoption name MultiPV value 1')
        worker.postMessage('setoption name Ponder value false')
        worker.postMessage('isready')
        return
      }
      if (message === 'readyok') {
        window.clearTimeout(startupTimer)
        readyRef.current = true
        setReady(true)
        setError(null)
        const queued = queuedSearchRef.current
        queuedSearchRef.current = null
        if (queued) runSearch(queued)
        return
      }
      if (message.startsWith('info ')) {
        const active = activeSearchRef.current
        if (!active || active.id !== latestRequestIdRef.current || (!active.historical && active.fen !== currentFenRef.current())) return
        const parsed = parseUciInfo(active.fen, message)
        if (!parsed) return
        if (!active.historical) {
          setCandidates((previous) => {
            const updated = previous.filter((candidate) => candidate.rank !== parsed.rank)
            updated.push(parsed)
            return updated.sort((a, b) => a.rank - b.rank)
          })
        }
        if (parsed.rank === 1) {
          const nextLine: EngineLine = {
            score: parsed.score,
            mate: parsed.mate,
            depth: parsed.depth,
            bestMove: parsed.bestMove,
            bestUci: parsed.bestUci,
            line: parsed.line,
            fen: active.fen,
            requestId: active.id,
          }
          active.bestLine = nextLine
          if (!active.historical) setLine(nextLine)
        }
        return
      }
      if (message === 'bestmove' || message.startsWith('bestmove ')) {
        const completed = activeSearchRef.current
        activeSearchRef.current = null
        stoppingRef.current = false
        if (completed?.id === latestRequestIdRef.current) {
          setThinking(false)
          const positionIsCurrent = completed.historical || completed.fen === currentFenRef.current()
          const result = positionIsCurrent ? completed.bestLine ?? null : null
          if (positionIsCurrent && !result) setError('Stockfish finished without a usable evaluation. Check the engine settings and try again.')
          completed.resolve?.(result)
          const uciMove = message.split(/\s+/)[1]
          if (completed.playMove && uciMove && uciMove !== '(none)' && completed.fen === currentFenRef.current()) {
            onBestMoveRef.current(completed.fen, uciMove)
          }
        } else {
          completed?.resolve?.(null)
        }
        const queued = queuedSearchRef.current
        queuedSearchRef.current = null
        if (queued && (queued.historical || queued.fen === currentFenRef.current())) runSearch(queued)
        else {
          queued?.resolve?.(null)
          setThinking(false)
        }
      }
    }
    worker.onerror = () => {
      window.clearTimeout(startupTimer)
      readyRef.current = false
      setReady(false)
      setThinking(false)
      setLine(EMPTY_ENGINE_LINE)
      setCandidates([])
      setError('Stockfish stopped unexpectedly. Reload the page to restart the engine.')
      activeSearchRef.current?.resolve?.(null)
      queuedSearchRef.current?.resolve?.(null)
      activeSearchRef.current = null
      queuedSearchRef.current = null
    }
    worker.postMessage('uci')
    return () => {
      window.clearTimeout(startupTimer)
      readyRef.current = false
      latestRequestIdRef.current = -1
      activeSearchRef.current?.resolve?.(null)
      queuedSearchRef.current?.resolve?.(null)
      activeSearchRef.current = null
      queuedSearchRef.current = null
      stoppingRef.current = false
      worker.onmessage = null
      worker.onerror = null
      worker.postMessage('quit')
      worker.terminate()
      workerRef.current = null
    }
  }, [runSearch])

  return { ready, thinking, threads, line, candidates, settings, error, analyze, analyzeAsync, playBestMove, updateSettings, stop }
}
