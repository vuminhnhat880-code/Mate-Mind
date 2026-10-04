import { useCallback, useEffect, useRef, useState } from 'react'
import { classifyMove, formatEvaluation, reviewEvaluationScore } from '../lib/stockfish'
import type { EngineLine, EvaluationPoint, ReviewedMove, ReviewPosition } from '../types/chess'

type UseGameReviewOptions = {
  getPositions: () => ReviewPosition[]
  analyze: (fen: string, positionCommand: string, depth: number) => Promise<EngineLine | null>
  stopAnalysis: () => void
  reanalyzeCurrent: () => void
  recordEvaluation: (point: EvaluationPoint) => void
  engineReady: boolean
  depth: number
}

export function useGameReview({
  getPositions, analyze, stopAnalysis, reanalyzeCurrent, recordEvaluation, engineReady, depth,
}: UseGameReviewOptions) {
  const [reviewedMoves, setReviewedMoves] = useState<ReviewedMove[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)
  const runningRef = useRef(false)
  const runIdRef = useRef(0)
  const optionsRef = useRef({ getPositions, analyze, stopAnalysis, reanalyzeCurrent, recordEvaluation, engineReady, depth })
  optionsRef.current = { getPositions, analyze, stopAnalysis, reanalyzeCurrent, recordEvaluation, engineReady, depth }

  useEffect(() => () => {
    cancelledRef.current = true
    runIdRef.current += 1
    runningRef.current = false
  }, [])

  const invalidate = useCallback(() => {
    cancelledRef.current = true
    runIdRef.current += 1
    runningRef.current = false
    setProgress(null)
    setReviewedMoves([])
    setSummary(null)
    setError(null)
  }, [])

  const clear = useCallback(() => {
    invalidate()
    setReviewedMoves([])
    setSummary(null)
    setError(null)
  }, [invalidate])

  const cancel = useCallback(() => {
    clear()
    optionsRef.current.stopAnalysis()
    optionsRef.current.reanalyzeCurrent()
  }, [clear])

  const start = useCallback(async () => {
    const options = optionsRef.current
    if (!options.engineReady || runningRef.current) return
    const positions = options.getPositions()
    if (positions.length < 2) {
      setError('Make or import at least one move before reviewing a game.')
      return
    }
    options.stopAnalysis()
    const runId = ++runIdRef.current
    cancelledRef.current = false
    runningRef.current = true
    setError(null)
    setReviewedMoves([])
    setSummary(null)
    setProgress({ completed: 0, total: positions.length })
    let previous: number | null = null
    const results: ReviewedMove[] = []
    try {
      for (let index = 0; index < positions.length; index += 1) {
        if (cancelledRef.current || runId !== runIdRef.current) break
        const position = positions[index]
        const result = await optionsRef.current.analyze(position.fen, position.positionCommand, Math.min(optionsRef.current.depth, 14))
        if (cancelledRef.current || runId !== runIdRef.current) break
        if (!result || result.fen !== position.fen || result.score === null && result.mate === null) {
          setError('Stockfish could not finish a position review. Try again when the engine is idle.')
          break
        }
        const score = reviewEvaluationScore(result.score, result.mate)
        if (score === null) {
          setError('Stockfish returned no usable evaluation for this position. Try the review again.')
          break
        }
        optionsRef.current.recordEvaluation({ ply: position.ply, fen: position.fen, score, mate: result.mate, source: 'review' })
        if (position.move && previous !== null) {
          const side = position.move.color === 'w' ? 1 : -1
          const moverBefore = previous * side
          const moverAfter = score * side
          const loss = Math.max(0, moverBefore - moverAfter)
          const materialGain = side * (position.move.materialAfter - position.move.materialBefore) * 100
          results.push({
            ply: position.ply,
            san: position.move.san,
            classification: classifyMove(loss, materialGain, { moverBefore, moverAfter }),
            centipawnLoss: loss,
            before: previous,
            after: score,
          })
          setReviewedMoves([...results])
        }
        previous = score
        if (index === positions.length - 1) setSummary(formatEvaluation(result.score, result.mate))
        setProgress({ completed: index + 1, total: positions.length })
      }
    } catch (cause) {
      if (!cancelledRef.current && runId === runIdRef.current) {
        setError(cause instanceof Error ? `Game review failed: ${cause.message}` : 'Game review failed unexpectedly.')
      }
    } finally {
      if (runId === runIdRef.current) {
        runningRef.current = false
        setProgress(null)
        if (!cancelledRef.current) optionsRef.current.reanalyzeCurrent()
      }
    }
  }, [])

  return { reviewedMoves, summary, progress, error, start, cancel, clear, invalidate }
}
