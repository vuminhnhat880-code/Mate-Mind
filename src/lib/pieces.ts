import type { PieceSymbol } from 'chess.js'

export const PIECE_GLYPHS: Record<`${'w' | 'b'}${PieceSymbol}`, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}
