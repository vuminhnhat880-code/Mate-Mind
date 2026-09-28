import { useCallback, useEffect, useRef, useState } from 'react'
import type { EngineLine } from '../types/chess'
import { EMPTY_ENGINE_LINE } from '../types/chess'
import { parsePrincipalVariation } from '../lib/stockfish'

type SearchRequest = {
  fen: string
  positionCommand: string
  depth: number
  playMove: boolean
}

type UseStockfishOptions = {
  getCurrentFen: () => string
  onBestMove: (fen: string, uciMove: string) => void
}

export function useStockfish({ getCurrentFen, onBestMove }: UseStockfishOptions) {
  const workerRef = useRef<Worker | null>(null)
  const readyRef = useRef(false)
  const activeSearchRef = useRef<SearchRequest | null>(null)
  const queuedSearchRef = useRef<SearchRequest | null>(null)
  const stoppingRef = useRef(false)
  const currentFenRef = useRef(getCurrentFen)
  const onBestMoveRef = useRef(onBestMove)
  const [ready, setReady] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [threads, setThreads] = useState(0)
  const [line, setLine] = useState<EngineLine>(EMPTY_ENGINE_LINE)

  currentFenRef.current = getCurrentFen
  onBestMoveRef.current = onBestMove

  const runSearch = useCallback((request: SearchRequest) => {
    const worker = workerRef.current
    if (!worker || !readyRef.current) return
    setLine(EMPTY_ENGINE_LINE)
    if (activeSearchRef.current) {
      queuedSearchRef.current = request
      if (!stoppingRef.current) {
        stoppingRef.current = true
        worker.postMessage('stop')
      }
      return
    }
    activeSearchRef.current = request
    stoppingRef.current = false
    setThinking(true)
    worker.postMessage(request.positionCommand)
    worker.postMessage(request.playMove ? 'go movetime 7000' : request.depth ? `go depth ${request.depth}` : 'go infinite')
  }, [])

  const analyze = useCallback((fen: string, positionCommand: string, depth = 0) => {
    runSearch({ fen, positionCommand, depth, playMove: false })
  }, [runSearch])

  const playBestMove = useCallback((fen: string, positionCommand: string) => {
    runSearch({ fen, positionCommand, depth: 0, playMove: true })
  }, [runSearch])

  const stop = useCallback(() => {
    queuedSearchRef.current = null
    if (activeSearchRef.current && !stoppingRef.current) {
      stoppingRef.current = true
      workerRef.current?.postMessage('stop')
    }
  }, [])

  useEffect(() => {
    const worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19.js`)
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<string>) => {
      const message = String(event.data).trim()
      if (message === 'uciok') {
        const availableThreads = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 8))
        const hashMb = Math.max(256, Math.min(1024, availableThreads * 64))
        setThreads(availableThreads)
        worker.postMessage('setoption name UCI_Elo value 3190')
        worker.postMessage('setoption name Skill Level value 20')
        worker.postMessage('setoption name Ponder value false')
        worker.postMessage(`setoption name Threads value ${availableThreads}`)
        worker.postMessage(`setoption name Hash value ${hashMb}`)
        worker.postMessage('isready')
      }
      if (message === 'readyok') {
        readyRef.current = true
        setReady(true)
      }
      if (message.startsWith('info ')) {
        const active = activeSearchRef.current
        if (!active || active.fen !== currentFenRef.current()) return
        const depth = Number(message.match(/\bdepth (\d+)/)?.[1] ?? 0)
        const scoreMatch = message.match(/\bscore (cp|mate) (-?\d+)/)
        const pv = message.match(/\bpv (.+)$/)?.[1]?.split(' ') ?? []
        if (!scoreMatch || !pv.length || /\b(?:lowerbound|upperbound)\b/.test(message)) return
        const value = Number(scoreMatch[2])
        const score = scoreMatch[1] === 'cp' ? value * (active.fen.split(' ')[1] === 'b' ? -1 : 1) : null
        const mate = scoreMatch[1] === 'mate' ? value * (active.fen.split(' ')[1] === 'b' ? -1 : 1) : null
        const variation = parsePrincipalVariation(active.fen, pv)
        setLine({ score, mate, depth, bestMove: variation[0] ?? '', bestUci: pv[0] ?? '', line: variation })
      }
      if (message.startsWith('bestmove ')) {
        const completed = activeSearchRef.current
        activeSearchRef.current = null
        stoppingRef.current = false
        setThinking(false)
        const uciMove = message.split(' ')[1]
        if (completed?.playMove && uciMove && uciMove !== '(none)' && completed.fen === currentFenRef.current()) {
          onBestMoveRef.current(completed.fen, uciMove)
        }
        const queued = queuedSearchRef.current
        queuedSearchRef.current = null
        if (queued && queued.fen === currentFenRef.current()) runSearch(queued)
      }
    }
    worker.onerror = () => {
      readyRef.current = false
      setReady(false)
      setThinking(false)
      setLine(EMPTY_ENGINE_LINE)
    }
    worker.postMessage('uci')
    return () => {
      readyRef.current = false
      worker.postMessage('quit')
      worker.terminate()
      workerRef.current = null
    }
  }, [runSearch])

  return { ready, thinking, threads, line, analyze, playBestMove, stop }
}