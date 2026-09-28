import type { Chess } from 'chess.js'
import type { EngineContext, Mode } from '../types/chess'
import { positionLabel } from './chess'

export function explainMove(text: string, game: Chess, context: EngineContext, mode: Mode) {
  const lower = text.toLowerCase()
  const moves = game.history()
  const material = context.material
  const advantage = material > 1 ? `White is up about ${material} points of material.` : material < -1 ? `Black is up about ${Math.abs(material)} points of material.` : 'Material is roughly equal.'
  const variation = context.principalVariation.length ? context.principalVariation.join(' ') : ''
  const best = context.bestMove ? `Stockfish’s top move is ${context.bestMove}${variation ? `, with ${variation} as the main line` : ''}.` : 'Stockfish does not have a completed best move for this position yet.'

  if (/hello|hi\b|hey\b|how are you/.test(lower)) return 'Doing well. There’s a board in front of us and nowhere better to be. What are you curious about?'
  if (/opening|what.*(defence|defense|opening)|name.*opening/.test(lower)) return `${context.opening}. ${moves.length < 6 ? 'We’re still in the opening moves, so the position is taking shape.' : 'The opening phase is starting to give way to a middlegame.'}`
  if (/castl|king.?side|queen.?side/.test(lower)) return 'Castling moves your king two squares toward a rook, then places that rook beside it. You can castle only if neither piece has moved, the path is clear, and your king is not in check or crossing an attacked square.'
  if (/en.?passant/.test(lower)) return 'En passant is the special pawn capture available immediately after an enemy pawn advances two squares past one of yours. Capture it as though it had moved just one square.'
  if (/promot/.test(lower)) return 'When a pawn reaches the far rank, choose a queen, rook, bishop, or knight to promote it.'
  if (/checkmate|mate\b|is it over/.test(lower)) return game.isCheckmate() ? `Yes, it’s checkmate. ${game.turn() === 'w' ? 'Black' : 'White'} wins.` : game.isDraw() ? 'The game is over by a draw.' : game.isCheck() ? 'The king is in check, but there are still legal replies.' : 'No checkmate yet. The game is still live.'
  if (/draw|stalemate|threefold|50.?move/.test(lower)) return game.isDraw() ? 'The position is drawn.' : game.isStalemate() ? 'It’s stalemate: the side to move has no legal moves, but its king is not in check.' : 'A draw can happen by agreement, stalemate, threefold repetition, the 50-move rule, or insufficient mating material. None has ended this game.'
  if (/undo|take back|retract/.test(lower)) return 'Use the back arrow below the board to undo a move. In Play mode, this takes back both your move and Stockbot’s reply when both have been played.'
  if (/best move|what should|recommend|suggest|play here|strongest/.test(lower)) return `${best} ${advantage}`
  if (/eval|winning|who.*better|who.*winning|advantage|score|position/.test(lower)) {
    const score = context.mate !== null ? `Stockfish sees mate in ${Math.abs(context.mate)} for ${context.mate > 0 ? 'White' : 'Black'}.` : context.evaluation === null ? 'Stockfish does not have a completed evaluation for this position yet.' : `Stockfish evaluates this at ${context.evaluation} from White’s perspective.`
    return `${score} ${advantage} ${best}`
  }
  if (/why|idea|plan|strategy|explain|understand/.test(lower)) return `${best} A useful human check: look for loose pieces, king safety, and forcing checks or captures before committing. ${advantage}`
  if (/play|game|challenge|opponent/.test(lower)) return mode === 'play' ? 'We’re already playing. Make your move on the board and I’ll reply.' : 'Choose Play above the board and I’ll take the black pieces. You can switch sides in the game controls.'
  return `I’m following the board: ${positionLabel(game)} ${best} Ask me about the evaluation, best move, opening, or a chess rule and I’ll dig in.`
}

export function stockfishChessReply(text: string, game: Chess, context: EngineContext, mode: Mode, humanColor: 'w' | 'b') {
  const lower = text.toLowerCase()
  const history = game.history({ verbose: true })
  const moveLabel = (move: (typeof history)[number], index: number) => `${Math.ceil((index + 1) / 2)}${move.color === 'w' ? '.' : '...'}${move.san}`
  const humanMove = history.map((move, index) => ({ move, index })).filter(({ move }) => move.color === humanColor).at(-1)
  const latestMove = history.at(-1)
  const lastIndex = history.length - 1
  const evaluation = context.mate !== null
    ? `Stockfish sees mate in ${Math.abs(context.mate)} for ${context.mate > 0 ? 'White' : 'Black'} from this position.`
    : context.evaluation === null ? 'Stockfish does not have a completed evaluation for this position yet.' : `Stockfish currently evaluates the position at ${context.evaluation} pawns from White’s perspective.`
  const variation = context.principalVariation.length ? ` The engine’s line is ${context.principalVariation.join(' ')}.` : ''
  const bestMove = context.bestMove ? ` Stockfish’s current best move is ${context.bestMove}.` : ' Stockfish has not completed a best move yet.'

  if (/last move|my move|my last|good move|bad move|blunder|mistake/.test(lower)) {
    if (mode === 'analysis') {
      if (!latestMove) return 'There are no moves in this line yet. Make or import a move first, and Stockfish can assess the position.'
      return `The last move recorded in this line is ${moveLabel(latestMove, lastIndex)}. ${evaluation}${bestMove}${variation}`
    }
    if (!humanMove) return 'You have not played a move yet. Make a move first, and Stockfish can assess the resulting position.'
    const opponentReply = latestMove && latestMove !== humanMove.move ? ` The latest reply is ${moveLabel(latestMove, lastIndex)}.` : ''
    return `Your last move was ${moveLabel(humanMove.move, humanMove.index)}.${opponentReply} ${evaluation}${bestMove}${variation}`
  }
  if (/checkmate|mate\b|is it over/.test(lower) && game.isCheckmate()) return `Checkmate. ${game.turn() === 'w' ? 'Black' : 'White'} wins.`
  if (/draw|stalemate|threefold|50.?move/.test(lower) && game.isDraw()) return 'The current position is a draw.'
  if (/opening|what.*(defence|defense|opening)|name.*opening|castl|king.?side|queen.?side|en.?passant|promot/.test(lower)) return explainMove(text, game, context, mode)
  if (/best move|what should|recommend|suggest|play here|strongest|what.*move|next move/.test(lower)) {
    if (!context.bestMove) return 'Stockfish is still analysing this exact position. I have not played a move; ask again once the engine line appears.'
    return `${bestMove}${variation} This move comes from Stockfish’s analysis of the current board position.`
  }
  return `${evaluation}${bestMove}${variation}`
}
