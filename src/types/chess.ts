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
}