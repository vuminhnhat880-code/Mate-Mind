import type { Chess } from 'chess.js'
import { EMPTY_ENGINE_LINE, type EngineContext, type EngineLine, type Mode } from '../types/chess'
import { detectOpening } from './openings'

export function positionLabel(game: Chess) {
  if (game.isCheckmate()) return `Checkmate. ${game.turn() === 'w' ? 'Black' : 'White'} wins.`
  if (game.isDraw()) return 'Drawn position.'
  if (game.isCheck()) return `${game.turn() === 'w' ? 'White' : 'Black'} is in check.`
  return `${game.turn() === 'w' ? 'White' : 'Black'} to move.`
}

export function materialBalance(game: Chess) {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
  let total = 0
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece && piece.type !== 'k') total += (piece.color === 'w' ? 1 : -1) * values[piece.type]
    }
  }
  return total
}

export function createEngineContext(game: Chess, mode: Mode, line: EngineLine): EngineContext {
  const currentLine = line.fen && line.fen !== game.fen() ? EMPTY_ENGINE_LINE : line
  return {
    mode,
    fen: game.fen(),
    sideToMove: game.turn() === 'w' ? 'White' : 'Black',
    evaluation: currentLine.mate !== null ? `M${currentLine.mate}` : currentLine.score === null ? null : `${currentLine.score >= 0 ? '+' : ''}${(currentLine.score / 100).toFixed(2)}`,
    mate: currentLine.mate,
    bestMove: currentLine.bestMove || null,
    principalVariation: currentLine.line,
    depth: currentLine.depth,
    material: materialBalance(game),
    opening: detectOpening(game.history()),
  }
}

export function engineContextPrompt(context: EngineContext, moves: string[]) {
  return `Live chess context:\nMode: ${context.mode}\nFEN: ${context.fen}\nSide to move: ${context.sideToMove}\nMove history (SAN): ${moves.join(' ') || 'No moves yet'}\nOpening: ${context.opening}\nStockfish evaluation: ${context.evaluation ?? 'unavailable; Stockfish has not completed an evaluation'}\nMate score: ${context.mate === null ? 'none reported' : context.mate}\nBest move: ${context.bestMove ?? 'unavailable'}\nPrincipal variation: ${context.principalVariation.join(' ') || 'unavailable'}\nSearch depth: ${context.depth || 'not available'}\nMaterial balance: ${context.material} (positive favors White)`
}