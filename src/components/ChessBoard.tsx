import type { Chess, Square } from 'chess.js'
import type { EngineLine, Mode } from '../types/chess'

const PIECES: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function arrowPoints(uciMove: string, orientation: 'w' | 'b') {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uciMove)) return null
  const pointFor = (square: string) => {
    const fileIndex = square.charCodeAt(0) - 97
    const rankIndex = Number(square[1]) - 1
    const column = orientation === 'w' ? fileIndex : 7 - fileIndex
    const row = orientation === 'w' ? 7 - rankIndex : rankIndex
    return { x: column + 0.5, y: row + 0.5 }
  }
  const from = pointFor(uciMove.slice(0, 2))
  const to = pointFor(uciMove.slice(2, 4))
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  const distance = Math.hypot(deltaX, deltaY)
  const curve = Math.min(0.4, distance * 0.13)
  const offsetX = (-deltaY / distance) * curve
  const offsetY = (deltaX / distance) * curve
  const control1X = from.x + deltaX / 3 + offsetX
  const control1Y = from.y + deltaY / 3 + offsetY
  const control2X = from.x + deltaX * 2 / 3 + offsetX
  const control2Y = from.y + deltaY * 2 / 3 + offsetY
  return {
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    path: `M ${from.x} ${from.y} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${to.x} ${to.y}`,
  }
}

type ChessBoardProps = {
  game: Chess
  orientation: 'w' | 'b'
  mode: Mode
  humanColor: 'w' | 'b'
  selected: Square | null
  legalTargets: Square[]
  lastMove: [Square, Square] | null
  draggingSquare: Square | null
  dragTarget: Square | null
  resigned: boolean
  engineLine: EngineLine
  onSquare: (square: Square) => void
  onNewGame: () => void
}

export function ChessBoard({ game, orientation, mode, humanColor, selected, legalTargets, lastMove, draggingSquare, dragTarget, resigned, engineLine, onSquare, onNewGame }: ChessBoardProps) {
  const ranks = orientation === 'w' ? [...Array(8).keys()].map((index) => 7 - index) : [...Array(8).keys()]
  const files = orientation === 'w' ? FILES : [...FILES].reverse()
  const arrow = mode === 'analysis' && engineLine.bestUci ? arrowPoints(engineLine.bestUci, orientation) : null
  const material = game.board().flat().reduce((balance, piece) => {
    if (!piece || piece.type === 'k') return balance
    const value = ({ p: 1, n: 3, b: 3, r: 5, q: 9 } as const)[piece.type]
    return balance + (piece.color === 'w' ? value : -value)
  }, 0)

  return <>
    <div className="player-row opponent-row">
      <div className="player-avatar bot-avatar"><span>♞</span></div>
      <div className="player-ident"><strong>{mode === 'play' ? 'Stockbot' : 'Black'}</strong><span>{mode === 'play' ? `Stockfish 19 · ${humanColor === 'w' ? 'Black' : 'White'}` : 'Analysis board'}</span></div>
      <div className="player-material">{material < 0 ? '−'.repeat(Math.min(Math.abs(material), 3)) : ''}</div>
    </div>
    <div className="board-wrap" aria-label="Chess board">
      <div className="eval-rail" aria-label={`Evaluation advantage ${engineLine.mate !== null ? `M${engineLine.mate}` : engineLine.score === null ? '—' : (engineLine.score / 100).toFixed(2)}; bar indicates the engine advantage`}><div className="eval-black" style={{ height: `${100 - (engineLine.mate !== null ? engineLine.mate > 0 ? 100 : 0 : engineLine.score === null ? 50 : 100 / (1 + Math.pow(10, -Math.max(-2000, Math.min(2000, engineLine.score)) / 400)))}%` }} /><span className="eval-score">{engineLine.mate !== null ? `M${engineLine.mate}` : engineLine.score === null ? '—' : `${engineLine.score >= 0 ? '+' : ''}${(engineLine.score / 100).toFixed(2)}`}</span></div>
      <div className="chessboard">
        {ranks.map((rank, rowIndex) => files.map((file, columnIndex) => {
          const square = `${file}${rank + 1}` as Square
          const piece = game.get(square)
          const isLight = (rank + columnIndex) % 2 === 1
          const isLast = lastMove?.includes(square) ?? false
          const isTarget = legalTargets.includes(square)
          const isCapture = isTarget && Boolean(piece)
          return <button
            className={`square ${isLight ? 'light' : 'dark'} ${selected === square ? 'selected' : ''} ${isLast ? 'last-move' : ''} ${isTarget ? 'legal-target' : ''} ${isCapture ? 'capture-target' : ''} ${draggingSquare === square ? 'drag-source' : ''} ${dragTarget === square ? 'drag-target' : ''}`}
            key={square}
            data-square={square}
            onClick={() => onSquare(square)}
            onKeyDown={(event) => {
              const directions: Record<string, [number, number]> = {
                ArrowLeft: [orientation === 'w' ? -1 : 1, 0],
                ArrowRight: [orientation === 'w' ? 1 : -1, 0],
                ArrowUp: [0, orientation === 'w' ? 1 : -1],
                ArrowDown: [0, orientation === 'w' ? -1 : 1],
              }
              const direction = directions[event.key]
              if (!direction) return
              event.preventDefault()
              const nextFile = square.charCodeAt(0) - 97 + direction[0]
              const nextRank = Number(square[1]) - 1 + direction[1]
              if (nextFile < 0 || nextFile > 7 || nextRank < 0 || nextRank > 7) return
              const nextSquare = `${String.fromCharCode(97 + nextFile)}${nextRank + 1}`
              document.querySelector<HTMLButtonElement>(`.square[data-square="${nextSquare}"]`)?.focus()
            }}
            disabled={resigned || game.isGameOver() || (mode === 'play' && game.turn() !== humanColor)}
            aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ' empty'}${isTarget ? ', legal destination' : ''}`}
            aria-pressed={selected === square}
            title={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
          >
            {piece && <span className={`piece ${piece.color === 'w' ? 'piece-white' : 'piece-black'}`} data-glyph={PIECES[`${piece.color}${piece.type}`]}>{PIECES[`${piece.color}${piece.type}`]}</span>}
            {isTarget && !piece && <span className="move-dot" />}
            {columnIndex === 0 && <span className="coordinate rank-coordinate">{rank + 1}</span>}
            {rowIndex === 7 && <span className="coordinate file-coordinate">{file}</span>}
          </button>
        }))}
        {arrow && <svg className="best-move-arrow" viewBox="0 0 8 8" role="img" aria-label={`Stockfish recommends ${engineLine.bestMove}`}>
          <defs>
            <linearGradient id="stockbot-arrow-gradient" x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#e99558" /><stop offset="55%" stopColor="#f3d45b" /><stop offset="100%" stopColor="#fff1a4" /></linearGradient>
            <filter id="stockbot-arrow-glow" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="0.055" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <marker id="stockbot-arrow-head" viewBox="0 0 10 10" refX="8.4" refY="5" markerWidth="0.4" markerHeight="0.4" orient="auto"><path d="M 0 0.8 L 9.2 5 L 0 9.2 Q 2.5 5 0 0.8 Z" /></marker>
          </defs>
          <circle className="best-move-origin" cx={arrow.x1} cy={arrow.y1} r="0.24" />
          <path className="best-move-arrow-shadow" d={arrow.path} />
          <path className="best-move-arrow-line" d={arrow.path} markerEnd="url(#stockbot-arrow-head)" />
          <path className="best-move-arrow-trail" d={arrow.path} pathLength="1" />
          <circle className="best-move-target" cx={arrow.x2} cy={arrow.y2} r="0.3" />
        </svg>}
        {game.isCheckmate() || game.isDraw() ? <div className="game-result-overlay" role="status" aria-live="polite">
          <div className="game-result-card"><span>GAME OVER</span><strong>{game.isCheckmate() ? 'Checkmate' : 'Draw'}</strong><em>{game.isCheckmate() ? `${game.turn() === 'w' ? 'Black' : 'White'} wins` : game.isStalemate() ? 'Stalemate' : 'The game is drawn'}</em><button onClick={onNewGame}>New game</button></div>
        </div> : null}
      </div>
    </div>
    <div className="player-row user-row">
      <div className="player-avatar user-avatar"><span>{humanColor === 'w' ? '♙' : '♟'}</span></div>
      <div className="player-ident"><strong>You</strong><span>{humanColor === 'w' ? 'White' : 'Black'} · {mode === 'play' ? 'Your turn' : 'Exploring'}</span></div>
      <div className="player-material">{material > 0 ? '+'.repeat(Math.min(material, 3)) : ''}</div>
    </div>
  </>
}
