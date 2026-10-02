import type { Move, PieceSymbol, Square } from 'chess.js'

export type Mode = 'play' | 'analysis'
export type ImportFormat = 'fen' | 'pgn'
export type ChatStatus = 'checking' | 'ready' | 'offline' | 'thinking'
export type PromotionPiece = Extract<PieceSymbol, 'q' | 'r' | 'b' | 'n'>

export type EngineLine = {
  score: number | null
  mate: number | null
  depth: number
  bestMove: string
  bestUci: string
  line: string[]
  fen?: string
  requestId?: number
  candidates?: EngineCandidate[]
}

export type EngineCandidate = {
  rank: number
  score: number | null
  mate: number | null
  bestMove: string
  bestUci: string
  line: string[]
  depth: number
}

export type EngineSettings = {
  depth: number
  moveTime: number
  threads: number
  hash: number
  multiPv: 1 | 2 | 3 | 5
}

export type EvaluationPoint = {
  ply: number
  fen: string
  score: number
  mate: number | null
  source: 'live' | 'review'
}

export type MoveClassification = 'Brilliant' | 'Best' | 'Excellent' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder'
export type ReviewedMove = {
  ply: number
  san: string
  classification: MoveClassification
  centipawnLoss: number
  before: number
  after: number
}

export type ReviewPosition = {
  ply: number
  fen: string
  positionCommand: string
  move: {
    san: string
    color: 'w' | 'b'
    materialBefore: number
    materialAfter: number
  } | null
}

export type MoveSnapshot = Pick<Move, 'from' | 'to' | 'promotion' | 'color' | 'san'>

export type PendingPromotion = {
  from: Square
  to: Square
  color: 'w' | 'b'
}

export type EngineContext = {
  mode: Mode
  fen: string
  sideToMove: 'White' | 'Black'
  evaluation: string | null
  mate: number | null
  bestMove: string | null
  principalVariation: string[]
  depth: number
  material: number
  opening: string
}

export const EMPTY_ENGINE_LINE: EngineLine = {
  score: null,
  mate: null,
  depth: 0,
  bestMove: '',
  bestUci: '',
  line: [],
  candidates: [],
}