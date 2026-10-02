import { Chess } from 'chess.js'
import type { EngineCandidate, EngineLine, EngineSettings, EvaluationPoint, MoveClassification } from '../types/chess'

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  depth: 18,
  moveTime: 1500,
  threads: 4,
  hash: 256,
  multiPv: 1,
}

export const ENGINE_SETTINGS_KEY = 'stockbot.engine-settings.v1'
export const MOVE_CLASSIFICATION_THRESHOLDS = {
  best: 10,
  excellent: 25,
  good: 60,
  inaccuracy: 120,
  mistake: 250,
  brilliantSacrifice: -300,
  brilliantMaxLoss: 25,
  brilliantRequiredAdvantage: 150,
  brilliantMinPriorScore: -100,
  brilliantMaxPriorAdvantage: 100,
} as const

export function readEngineSettings(storage: Pick<Storage, 'getItem'> | undefined, hardwareConcurrency = 4): EngineSettings {
  const defaults = { ...DEFAULT_ENGINE_SETTINGS, threads: Math.max(1, Math.min(8, hardwareConcurrency || 4)) }
  if (!storage) return defaults
  try {
    const value: unknown = JSON.parse(storage.getItem(ENGINE_SETTINGS_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return defaults
    const saved = value as Record<string, unknown>
    const multiPv = saved.multiPv
    return {
      depth: boundedInteger(saved.depth, defaults.depth, 8, 40),
      moveTime: boundedInteger(saved.moveTime, defaults.moveTime, 250, 15000),
      threads: boundedInteger(saved.threads, defaults.threads, 1, Math.min(16, Math.max(1, hardwareConcurrency || 4))),
      hash: boundedInteger(saved.hash, defaults.hash, 64, 2048),
      multiPv: multiPv === 2 || multiPv === 3 || multiPv === 5 ? multiPv : 1,
    }
  } catch {
    return defaults
  }
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback
}

export function formatEvaluation(score: number | null, mate: number | null) {
  if (mate !== null) return `M${mate}`
  if (score === null) return '—'
  return `${score >= 0 ? '+' : ''}${(score / 100).toFixed(2)}`
}

export function evaluationForPosition(
  history: EvaluationPoint[],
  fen: string,
  ply: number,
  liveLine: EngineLine,
): Pick<EngineLine, 'score' | 'mate'> {
  const reviewed = history.find((point) => point.source === 'review' && point.fen === fen && point.ply === ply)
  if (reviewed) return reviewed
  if (liveLine.fen === fen) return liveLine
  return { score: null, mate: null }
}

export function upsertEvaluationPoint(history: EvaluationPoint[], point: EvaluationPoint): EvaluationPoint[] {
  const samePosition = (item: EvaluationPoint) => item.ply === point.ply && item.fen === point.fen
  if (point.source === 'live' && history.some((item) => item.source === 'review' && samePosition(item))) return history
  return [...history.filter((item) => !samePosition(item)), point]
    .sort((left, right) => left.ply - right.ply)
    .slice(-120)
}

export function reviewEvaluationScore(score: number | null, mate: number | null): number | null {
  if (score !== null) return score
  if (mate === null) return null
  if (mate === 0) return 0
  const mateValue = 10000 - Math.min(Math.abs(mate), 100) * 10
  return Math.sign(mate) * mateValue
}

export function parseUciInfo(fen: string, message: string): EngineCandidate | null {
  if (!message.startsWith('info ') || /\b(?:lowerbound|upperbound)\b/.test(message)) return null
  const scoreMatch = message.match(/\bscore (cp|mate) (-?\d+)/)
  const pvMatch = message.match(/\bpv (.+)$/)
  if (!scoreMatch || !pvMatch) return null
  const scoreValue = Number(scoreMatch[2])
  const depth = Number(message.match(/\bdepth (\d+)/)?.[1] ?? 0)
  const rank = Number(message.match(/\bmultipv (\d+)/)?.[1] ?? 1)
  const turnSign = fen.split(' ')[1] === 'b' ? -1 : 1
  const moves = pvMatch[1].trim().split(/\s+/).filter(Boolean)
  if (!moves.length || !Number.isFinite(scoreValue) || !Number.isFinite(depth) || !Number.isFinite(rank)) return null
  const line = parsePrincipalVariation(fen, moves)
  if (!line.length) return null
  return {
    rank,
    score: scoreMatch[1] === 'cp' ? scoreValue * turnSign : null,
    mate: scoreMatch[1] === 'mate' ? scoreValue * turnSign : null,
    bestMove: line[0],
    bestUci: moves[0],
    line,
    depth,
  }
}

export function classifyMove(
  centipawnLoss: number,
  materialGain = 0,
  perspective?: { moverBefore: number; moverAfter: number },
): MoveClassification {
  const loss = Math.max(0, centipawnLoss)
  const thresholds = MOVE_CLASSIFICATION_THRESHOLDS
  if (
    materialGain <= thresholds.brilliantSacrifice
    && loss <= thresholds.brilliantMaxLoss
    && perspective
    && perspective.moverBefore >= thresholds.brilliantMinPriorScore
    && perspective.moverBefore <= thresholds.brilliantMaxPriorAdvantage
    && perspective.moverAfter >= thresholds.brilliantRequiredAdvantage
  ) return 'Brilliant'
  if (loss <= thresholds.best) return 'Best'
  if (loss <= thresholds.excellent) return 'Excellent'
  if (loss <= thresholds.good) return 'Good'
  if (loss <= thresholds.inaccuracy) return 'Inaccuracy'
  if (loss <= thresholds.mistake) return 'Mistake'
  return 'Blunder'
}

export function parsePrincipalVariation(fen: string, moves: string[]) {
  const game = new Chess(fen)
  const san: string[] = []
  for (const uci of moves.slice(0, 8)) {
    try {
      const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      san.push(move.san)
    } catch {
      break
    }
  }
  return san
}

export function enginePositionCommand(game: Chess, baseFen: string) {
  const initialFen = new Chess().fen()
  const position = baseFen === initialFen ? 'startpos' : `fen ${baseFen}`
  const moves = game.history({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
  return `position ${position}${moves.length ? ` moves ${moves.join(' ')}` : ''}`
}