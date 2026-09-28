import { Chess } from 'chess.js'

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