import { useEffect, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  Crown,
  Flag,
  FileUp,
  Gauge,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  SquarePen,
  Swords,
  Zap,
  X,
} from 'lucide-react'

type ChatMessage = { role: 'assistant' | 'user'; text: string }
type EngineLine = { score: number; mate: number | null; depth: number; bestMove: string; bestUci: string; line: string[] }
type Mode = 'play' | 'analysis'
type SearchRequest = { fen: string; positionCommand: string; depth: number; playMove: boolean }
type ImportFormat = 'fen' | 'pgn'
type ChatStatus = 'checking' | 'ready' | 'offline'
type DragPointer = { pointerId: number; from: Square; startX: number; startY: number; moved: boolean }
type PointerPosition = { x: number; y: number }

const PIECES: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  text: "Hey, I'm Stockbot. Ask me anything, or ask about this position. I can explore moves with Stockfish while we talk.",
}

function positionLabel(game: Chess) {
  if (game.isCheckmate()) return `Checkmate. ${game.turn() === 'w' ? 'Black' : 'White'} wins.`
  if (game.isDraw()) return 'Drawn position.'
  if (game.isCheck()) return `${game.turn() === 'w' ? 'White' : 'Black'} is in check.`
  return `${game.turn() === 'w' ? 'White' : 'Black'} to move.`
}

function materialBalance(game: Chess) {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
  let total = 0
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece && piece.type !== 'k') total += (piece.color === 'w' ? 1 : -1) * values[piece.type]
    }
  }
  return total
}

function openingName(moves: string[]) {
  const line = moves.slice(0, 6).join(' ')
  if (line.startsWith('e4 e5 Nf3 Nc6 Bb5')) return 'Ruy Lopez'
  if (line.startsWith('e4 e5 Nf3 Nc6 Bc4')) return 'Italian Game'
  if (line.startsWith('e4 c5')) return 'Sicilian Defence'
  if (line.startsWith('e4 e6')) return 'French Defence'
  if (line.startsWith('e4 c6')) return 'Caro-Kann Defence'
  if (line.startsWith('d4 d5 c4')) return "Queen's Gambit"
  if (line.startsWith('d4 Nf6 c4 g6')) return "King's Indian Defence"
  if (line.startsWith('d4 Nf6 c4 e6')) return "Queen's Indian / Nimzo-Indian"
  if (line.startsWith('Nf3')) return 'Réti Opening'
  if (line.startsWith('e4')) return 'King’s Pawn Opening'
  if (line.startsWith('d4')) return 'Queen’s Pawn Opening'
  return null
}

function parsePrincipalVariation(fen: string, moves: string[]) {
  const copy = new Chess(fen)
  const san: string[] = []
  for (const uci of moves.slice(0, 4)) {
    try {
      const move = copy.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      san.push(move.san)
    } catch {
      break
    }
  }
  return san
}

function enginePositionCommand(game: Chess, baseFen: string) {
  const initialFen = new Chess().fen()
  const startPosition = baseFen === initialFen ? 'startpos' : `fen ${baseFen}`
  const moves = game.history({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
  return `position ${startPosition}${moves.length ? ` moves ${moves.join(' ')}` : ''}`
}

function bestMoveArrowPoints(uciMove: string, orientation: 'w' | 'b') {
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

function whiteWinningChance(score: number, mate: number | null) {
  if (mate !== null && mate !== 0) return mate > 0 ? 100 : 0
  const boundedScore = Math.max(-2000, Math.min(2000, score))
  return 100 / (1 + Math.pow(10, -boundedScore / 400))
}

function explainMove(text: string, game: Chess, engineLine: EngineLine, mode: Mode) {
  const lower = text.toLowerCase()
  const moves = game.history()
  const opening = openingName(moves)
  const material = materialBalance(game)
  const advantage = material > 1 ? `White is up about ${material} points of material.` : material < -1 ? `Black is up about ${Math.abs(material)} points of material.` : 'Material is roughly equal.'
  const line = engineLine.line.length ? engineLine.line.join(' ') : ''
  const best = engineLine.bestMove ? `The engine’s top move is ${engineLine.bestMove}${line ? `, with ${line} as the main line` : ''}.` : 'I’m still calculating the strongest continuation; give me a moment and ask again.'

  if (/hello|hi\b|hey\b|how are you/.test(lower)) return 'Doing well. There’s a board in front of us and nowhere better to be. What are you curious about?'
  if (/opening|what.*(defence|defense|opening)|name.*opening/.test(lower)) return opening ? `This is the ${opening}. ${moves.length < 6 ? 'We’re still in the opening moves, so the position is taking shape.' : 'The opening phase is starting to give way to a middlegame.'}` : 'We haven’t reached a named opening yet. Play a couple of moves and I’ll identify the line.'
  if (/castl|king.?side|queen.?side/.test(lower)) return 'Castling moves your king two squares toward a rook, then places that rook beside it. You can castle only if neither piece has moved, the path is clear, and your king isn’t in check or crossing an attacked square.'
  if (/en.?passant/.test(lower)) return 'En passant is the special pawn capture available immediately after an enemy pawn advances two squares past one of yours. Capture it as though it had moved just one square.'
  if (/promot/.test(lower)) return 'When a pawn reaches the far rank, it promotes, usually to a queen. This board promotes automatically to a queen for now.'
  if (/checkmate|mate\b|is it over/.test(lower)) return game.isCheckmate() ? `Yes, it’s checkmate. ${game.turn() === 'w' ? 'Black' : 'White'} wins.` : game.isDraw() ? 'The game is over by a draw.' : game.isCheck() ? 'The king is in check, but there are still legal replies.' : 'No checkmate yet. The game is still live.'
  if (/draw|stalemate|threefold|50.?move/.test(lower)) return game.isDraw() ? 'The position is drawn.' : game.isStalemate() ? 'It’s stalemate: the side to move has no legal moves, but its king isn’t in check.' : 'A draw can happen by agreement, stalemate, threefold repetition, the 50-move rule, or insufficient mating material. None has ended this game.'
  if (/undo|take back|retract/.test(lower)) return 'Use the back arrow below the board to take back the last move. In a game, it takes back both your move and my reply.'
  if (/best move|what should|recommend|suggest|play here|strongest/.test(lower)) return `${best} ${advantage}`
  if (/eval|winning|who.*better|advantage|score|position/.test(lower)) {
    const score = engineLine.mate !== null ? `The engine sees mate in ${Math.abs(engineLine.mate)} for ${engineLine.mate > 0 ? 'White' : 'Black'}.` : `Stockfish evaluates this at ${engineLine.score >= 0 ? '+' : ''}${(engineLine.score / 100).toFixed(1)} from White’s perspective.`
    return `${score} ${advantage} ${best}`
  }
  if (/why|idea|plan|strategy|explain|understand/.test(lower)) return `${best} A useful human check: look for loose pieces, king safety, and forcing checks or captures before committing. ${advantage}`
  if (/play|game|challenge|opponent/.test(lower)) return mode === 'play' ? 'We’re already playing. Make your move on the board and I’ll reply.' : 'Choose Play above the board and I’ll take the black pieces. You can switch sides in the game controls.'
  return `I’m following the board: ${positionLabel(game)} ${best} Ask me about the evaluation, the best move, the opening, or a chess rule and I’ll dig in.`
}

function stockfishChessReply(text: string, game: Chess, engineLine: EngineLine, mode: Mode, humanColor: 'w' | 'b') {
  const lower = text.toLowerCase()
  const history = game.history({ verbose: true })
  const moveToLabel = (move: (typeof history)[number], index: number) => `${Math.ceil((index + 1) / 2)}${move.color === 'w' ? '.' : '...'}${move.san}`
  const humanMove = history.map((move, index) => ({ move, index })).filter(({ move }) => move.color === humanColor).at(-1)
  const latestMove = history.at(-1)
  const latestIndex = history.length - 1
  const evaluation = engineLine.mate !== null
    ? `Stockfish sees mate in ${Math.abs(engineLine.mate)} for ${engineLine.mate > 0 ? 'White' : 'Black'} from this position.`
    : `Stockfish currently evaluates the position at ${engineLine.score >= 0 ? '+' : ''}${(engineLine.score / 100).toFixed(1)} pawns from White’s perspective.`
  const variation = engineLine.line.length ? ` The engine’s line is ${engineLine.line.join(' ')}.` : ''
  const bestMove = engineLine.bestMove ? ` Stockfish’s current best move is ${engineLine.bestMove}.` : ' Stockfish is still calculating its best move.'

  if (/last move|my move|my last|good move|bad move|blunder|mistake/.test(lower)) {
    if (mode === 'analysis') {
      if (!latestMove) return 'There are no moves in this line yet. Make or import a move first, and Stockfish can assess the position.'
      return `The last move recorded in this line is ${moveToLabel(latestMove, latestIndex)}. ${evaluation}${bestMove}${variation}`
    }
    if (!humanMove) return 'You have not played a move yet. Make a move first, and Stockfish can assess the resulting position.'
    const moveLabel = moveToLabel(humanMove.move, humanMove.index)
    const opponentReply = latestMove && latestMove !== humanMove.move
      ? ` The latest reply on the board is ${moveToLabel(latestMove, latestIndex)}.`
      : ''
    return `Your last move was ${moveLabel}.${opponentReply} ${evaluation}${bestMove}${variation}`
  }
  if (/checkmate|mate\b|is it over/.test(lower) && game.isCheckmate()) return `Checkmate. ${game.turn() === 'w' ? 'Black' : 'White'} wins.`
  if (/draw|stalemate|threefold|50.?move/.test(lower) && game.isDraw()) return 'The current position is a draw.'
  if (/opening|what.*(defence|defense|opening)|name.*opening/.test(lower)) return explainMove(text, game, engineLine, mode)
  if (/castl|king.?side|queen.?side|en.?passant|promot/.test(lower)) return explainMove(text, game, engineLine, mode)
  if (/best move|what should|recommend|suggest|play here|strongest|what.*move|next move/.test(lower)) {
    if (!engineLine.bestMove) return 'Stockfish is still analysing this exact position. I have not played a move; ask again once the engine line appears.'
    return `${bestMove}${variation} This move comes from Stockfish’s analysis of the current board position.`
  }
  return `${evaluation}${bestMove}${variation}`
}

function App() {
  const gameRef = useRef(new Chess())
  const baseFenRef = useRef(gameRef.current.fen())
  const workerRef = useRef<Worker | null>(null)
  const engineReadyRef = useRef(false)
  const activeSearchRef = useRef<SearchRequest | null>(null)
  const queuedSearchRef = useRef<SearchRequest | null>(null)
  const stoppingSearchRef = useRef(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragPointerRef = useRef<DragPointer | null>(null)
  const suppressClickRef = useRef(false)
  const movePieceRef = useRef<(from: Square, to: Square) => boolean>(() => false)
  const [fen, setFen] = useState(gameRef.current.fen())
  const [history, setHistory] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('play')
  const [humanColor, setHumanColor] = useState<'w' | 'b'>('w')
  const [orientation, setOrientation] = useState<'w' | 'b'>('w')
  const [selected, setSelected] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Square[]>([])
  const [draggingSquare, setDraggingSquare] = useState<Square | null>(null)
  const [dragTarget, setDragTarget] = useState<Square | null>(null)
  const [dragPosition, setDragPosition] = useState<PointerPosition | null>(null)
  const [lastMove, setLastMove] = useState<[Square, Square] | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [draft, setDraft] = useState('')
  const [chatStatus, setChatStatus] = useState<ChatStatus>('checking')
  const [chatThinking, setChatThinking] = useState(false)
  const [engineReady, setEngineReady] = useState(false)
  const [engineThreads, setEngineThreads] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [resigned, setResigned] = useState(false)
  const resignedRef = useRef(resigned)
  const [engineLine, setEngineLine] = useState<EngineLine>({ score: 0, mate: null, depth: 0, bestMove: '', bestUci: '', line: [] })
  const [activeTab, setActiveTab] = useState<'moves' | 'details'>('moves')
  const [importOpen, setImportOpen] = useState(false)
  const [importFormat, setImportFormat] = useState<ImportFormat>('fen')
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const chatRequestId = useRef(0)

  const publishGame = () => {
    const current = gameRef.current
    setFen(current.fen())
    setHistory(current.history())
    setEngineLine({ score: 0, mate: null, depth: 0, bestMove: '', bestUci: '', line: [] })
    setLastMove(current.history({ verbose: true }).length
      ? (() => { const move = current.history({ verbose: true }).at(-1)!; return [move.from, move.to] as [Square, Square] })()
      : null)
    setSelected(null)
    setLegalTargets([])
  }

  const runSearch = (request: SearchRequest) => {
    const worker = workerRef.current
    if (!worker || !engineReadyRef.current) return
    setEngineLine({ score: 0, mate: null, depth: 0, bestMove: '', bestUci: '', line: [] })
    if (activeSearchRef.current) {
      queuedSearchRef.current = request
      if (!stoppingSearchRef.current) {
        stoppingSearchRef.current = true
        worker.postMessage('stop')
      }
      return
    }
    activeSearchRef.current = request
    stoppingSearchRef.current = false
    setThinking(true)
    worker.postMessage(request.positionCommand)
    worker.postMessage(request.playMove ? 'go movetime 7000' : request.depth ? `go depth ${request.depth}` : 'go infinite')
  }

  const createSearchRequest = (position: string, depth: number, playMove: boolean): SearchRequest => ({
    fen: position,
    positionCommand: gameRef.current.fen() === position ? enginePositionCommand(gameRef.current, baseFenRef.current) : `position fen ${position}`,
    depth,
    playMove,
  })
  const analyze = (position = gameRef.current.fen(), depth = 22) => runSearch(createSearchRequest(position, modeRef.current === 'analysis' ? 0 : depth, false))
  const askEngineToMove = (position = gameRef.current.fen()) => runSearch(createSearchRequest(position, 22, true))

  useEffect(() => {
    const worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19.js`)
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<string>) => {
      const message = String(event.data).trim()
      if (message === 'uciok') {
        const threads = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 8))
        const hashMb = Math.max(256, Math.min(1024, threads * 64))
        setEngineThreads(threads)
        worker.postMessage('setoption name UCI_Elo value 3190')
        worker.postMessage('setoption name Skill Level value 20')
        worker.postMessage('setoption name Ponder value false')
        worker.postMessage(`setoption name Threads value ${threads}`)
        worker.postMessage(`setoption name Hash value ${hashMb}`)
        worker.postMessage('isready')
      }
      if (message === 'readyok') {
        engineReadyRef.current = true
        setEngineReady(true)
        runSearch(createSearchRequest(gameRef.current.fen(), 18, false))
      }
      if (message.startsWith('info ')) {
        const depth = Number(message.match(/\bdepth (\d+)/)?.[1] ?? 0)
        const scoreMatch = message.match(/\bscore (cp|mate) (-?\d+)/)
        const rootFen = activeSearchRef.current?.fen ?? gameRef.current.fen()
        if (rootFen !== gameRef.current.fen()) return
        const rootTurn = rootFen.split(' ')[1]
        const pv = message.match(/\bpv (.+)$/)?.[1]?.split(' ') ?? []
        const sanLine = parsePrincipalVariation(rootFen, pv)
        if (scoreMatch && pv.length && !/\b(?:lowerbound|upperbound)\b/.test(message)) {
          const value = Number(scoreMatch[2])
          const nextLine: EngineLine = {
            score: value * (rootTurn === 'b' ? -1 : 1),
            mate: scoreMatch[1] === 'mate' ? value * (rootTurn === 'b' ? -1 : 1) : null,
            depth,
            bestMove: sanLine[0] ?? '',
            bestUci: pv[0] ?? '',
            line: sanLine,
          }
          setEngineLine(nextLine)
        }
      }
      if (message.startsWith('bestmove ')) {
        const completedSearch = activeSearchRef.current
        activeSearchRef.current = null
        stoppingSearchRef.current = false
        setThinking(false)
        if (completedSearch?.playMove && gameRef.current.fen() === completedSearch.fen && modeRef.current === 'play' && gameRef.current.turn() !== humanColorRef.current) {
          const uci = message.split(' ')[1]
          if (uci && uci !== '(none)') {
            try {
              gameRef.current.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
              publishGame()
              if (!gameRef.current.isGameOver()) setTimeout(() => analyze(gameRef.current.fen()), 100)
            } catch {
              setEngineLine((current) => ({ ...current, bestMove: '', bestUci: '' }))
            }
          }
        }
        const queuedSearch = queuedSearchRef.current
        queuedSearchRef.current = null
        if (queuedSearch && queuedSearch.fen === gameRef.current.fen()) runSearch(queuedSearch)
      }
    }
    worker.postMessage('uci')
    return () => {
      worker.postMessage('quit')
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const modeRef = useRef(mode)
  const humanColorRef = useRef(humanColor)
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { humanColorRef.current = humanColor }, [humanColor])
  useEffect(() => { resignedRef.current = resigned }, [resigned])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  const movePiece = (from: Square, to: Square) => {
    const game = gameRef.current
    if (from === to || resigned || game.isGameOver() || (mode === 'play' && game.turn() !== humanColor)) return false
    if (!game.moves({ square: from, verbose: true }).some((move) => move.to === to)) return false
    try {
      game.move({ from, to, promotion: 'q' })
      publishGame()
      if (game.isGameOver()) {
        setThinking(false)
      } else if (mode === 'play' && game.turn() !== humanColor) {
        setTimeout(() => askEngineToMove(game.fen()), 180)
      } else {
        setTimeout(() => analyze(game.fen()), 100)
      }
      return true
    } catch {
      return false
    }
  }
  movePieceRef.current = movePiece

  useEffect(() => {
    const findSquare = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('.square[data-square]')?.dataset.square as Square | undefined
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const square = findSquare(event.clientX, event.clientY)
      const piece = square && gameRef.current.get(square)
      if (!square || !piece || resignedRef.current || gameRef.current.isGameOver()) return
      if (modeRef.current === 'play' && (piece.color !== humanColorRef.current || gameRef.current.turn() !== humanColorRef.current)) return
      dragPointerRef.current = { pointerId: event.pointerId, from: square, startX: event.clientX, startY: event.clientY, moved: false }
    }
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragPointerRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return
      drag.moved = true
      event.preventDefault()
      setDraggingSquare(drag.from)
      setDragPosition({ x: event.clientX, y: event.clientY })
      setDragTarget(findSquare(event.clientX, event.clientY) ?? null)
    }
    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragPointerRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragPointerRef.current = null
      if (!drag.moved) return
      event.preventDefault()
      const target = findSquare(event.clientX, event.clientY)
      const moved = target ? movePieceRef.current(drag.from, target) : false
      if (!moved) {
        setSelected(drag.from)
        setLegalTargets(gameRef.current.moves({ square: drag.from, verbose: true }).map((move) => move.to))
      }
      setDraggingSquare(null)
      setDragTarget(null)
      setDragPosition(null)
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 50)
    }
    const handlePointerCancel = (event: PointerEvent) => {
      if (dragPointerRef.current?.pointerId !== event.pointerId) return
      dragPointerRef.current = null
      setDraggingSquare(null)
      setDragTarget(null)
      setDragPosition(null)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let retryTimer: number | undefined

    const checkChatModel = async () => {
      try {
        const response = await fetch('/api/ollama/api/tags')
        if (!response.ok) throw new Error('Local model service unavailable')
        const result = await response.json() as { models?: { name: string }[] }
        const modelAvailable = result.models?.some((model) => model.name === 'qwen3:1.7b' || model.name.startsWith('qwen3:1.7b-')) ?? false
        if (!cancelled) {
          setChatStatus(modelAvailable ? 'ready' : 'offline')
          if (!modelAvailable) {
            retryTimer = window.setTimeout(() => { void checkChatModel() }, 4000)
          }
        }
      } catch {
        if (!cancelled) {
          setChatStatus('offline')
          retryTimer = window.setTimeout(() => { void checkChatModel() }, 4000)
        }
      }
    }

    void checkChatModel()
    return () => {
      cancelled = true
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [])

  const handleSquare = (square: Square) => {
    if (suppressClickRef.current) return
    const game = gameRef.current
    if (resigned || game.isGameOver()) return
    const piece = game.get(square)
    if (selected && legalTargets.includes(square)) {
      if (movePiece(selected, square)) {
        return
      }
      setSelected(null)
      setLegalTargets([])
    }
    if (piece && (mode === 'analysis' || piece.color === humanColor)) {
      setSelected(square)
      setLegalTargets(game.moves({ square, verbose: true }).map((move) => move.to))
    } else {
      setSelected(null)
      setLegalTargets([])
    }
  }

  const startNewGame = (color = humanColor) => {
    const game = new Chess()
    gameRef.current = game
    baseFenRef.current = game.fen()
    setHumanColor(color)
    setOrientation(color)
    setResigned(false)
    queuedSearchRef.current = null
    publishGame()
    setMessages([INITIAL_MESSAGE])
    if (modeRef.current === 'play' && color === 'b') setTimeout(() => askEngineToMove(game.fen()), 250)
    else setTimeout(() => analyze(game.fen()), 100)
  }

  const changeMode = (nextMode: Mode) => {
    modeRef.current = nextMode
    setMode(nextMode)
    setResigned(false)
    queuedSearchRef.current = null
    if (nextMode === 'analysis') {
      setMessages((current) => [...current, { role: 'assistant', text: 'Analysis mode on. Explore any legal continuation; I’ll keep evaluating the position as it changes.' }])
      analyze()
    } else {
      startNewGame(humanColor)
      setMessages((current) => [...current, { role: 'assistant', text: 'Fresh game. You’re White; I’ll play Black.' }])
    }
  }

  const undoMove = () => {
    const game = gameRef.current
    if (mode === 'play' && game.history().length > 1) {
      game.undo()
      game.undo()
    } else {
      game.undo()
    }
    queuedSearchRef.current = null
    publishGame()
    setTimeout(() => analyze(game.fen()), 100)
  }

  const sendMessage = async (text = draft) => {
    const trimmed = text.trim()
    if (!trimmed || chatThinking) return
    const requestId = ++chatRequestId.current
    const currentGame = gameRef.current
    const isChessQuestion = /\b(chess|fen|pgn|stockfish|checkmate|stalemate|castling|castle|en passant|promotion|pawn|king|queen|rook|bishop|knight|opening|variation|tactic|blunder|board|position|evaluation|eval|winning|best move|next move|last move|my move|whose turn|your turn|my turn|legal move)\b/i.test(trimmed)
    setChatThinking(true)
    setMessages((current) => [...current, { role: 'user', text: trimmed }])
    setDraft('')
    inputRef.current?.focus()
    if (isChessQuestion) {
      const reply = stockfishChessReply(trimmed, currentGame, engineLine, mode, humanColor)
      setMessages((current) => [...current, { role: 'assistant', text: reply }])
      setChatThinking(false)
      return
    }
    const score = engineLine.mate !== null ? `mate ${engineLine.mate}` : `${engineLine.score >= 0 ? '+' : ''}${(engineLine.score / 100).toFixed(1)} pawns from White's perspective`
    const systemPrompt = `You are Stockbot, a friendly and thoughtful assistant. The user may discuss any subject, not just chess. Answer naturally and accurately; do not force every topic back to chess. When a question concerns chess, use this live board context and distinguish engine analysis from certainty.\n\nMode: ${mode}.\nCurrent FEN: ${currentGame.fen()}\nRecent moves: ${currentGame.history().slice(-30).join(' ') || 'No moves yet.'}\nSide to move: ${currentGame.turn() === 'w' ? 'White' : 'Black'}.\nStockfish evaluation: ${score}.\nStockfish best move and line: ${engineLine.bestMove ? `${engineLine.bestMove}; ${engineLine.line.join(' ')}` : 'No completed line yet.'}`
    const requestMessages = [
      ...messages.slice(-12).map((message) => ({ role: message.role, content: message.text })),
      { role: 'user', content: trimmed },
    ]
    try {
      const response = await fetch('/api/ollama/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3:1.7b',
          stream: false,
          think: false,
          options: { temperature: 0.7, num_ctx: 4096, num_predict: 350 },
          messages: [{ role: 'system', content: systemPrompt }, ...requestMessages],
        }),
      })
      if (!response.ok) throw new Error(`Local model request failed (${response.status})`)
      const result = await response.json() as { message?: { content?: string } }
      const reply = (result.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      if (!reply) throw new Error('Local model returned an empty response')
      if (requestId === chatRequestId.current) {
        setChatStatus('ready')
        setMessages((current) => [...current, { role: 'assistant', text: reply }])
      }
    } catch {
      if (requestId === chatRequestId.current) {
        setChatStatus('offline')
        const fallback = explainMove(trimmed, currentGame, engineLine, mode)
        setMessages((current) => [...current, { role: 'assistant', text: `I can't reach the local chat model right now. Please make sure Ollama is running. ${fallback}` }])
      }
    } finally {
      if (requestId === chatRequestId.current) setChatThinking(false)
    }
  }

  const importPosition = () => {
    const source = importText.trim()
    if (!source) {
      setImportError(`Paste a ${importFormat.toUpperCase()} position first.`)
      return
    }
    const importedGame = new Chess()
    try {
      if (importFormat === 'fen') importedGame.load(source)
      else importedGame.loadPgn(source)
    } catch {
      setImportError(`That ${importFormat.toUpperCase()} could not be loaded. Check its notation and try again.`)
      return
    }
    gameRef.current = importedGame
    const headers = importedGame.getHeaders()
    baseFenRef.current = importFormat === 'fen' ? source : headers.SetUp === '1' && headers.FEN ? headers.FEN : new Chess().fen()
    queuedSearchRef.current = null
    modeRef.current = 'analysis'
    setMode('analysis')
    setResigned(false)
    setOrientation(humanColor)
    setImportError('')
    setImportOpen(false)
    publishGame()
    setMessages((current) => [...current, { role: 'assistant', text: `${importFormat.toUpperCase()} loaded. We’re now analyzing the imported position.` }])
    analyze(importedGame.fen())
  }

  const game = new Chess(fen)
  const boardRows = orientation === 'w' ? [...Array(8).keys()].map((index) => 7 - index) : [...Array(8).keys()]
  const boardFiles = orientation === 'w' ? FILES : [...FILES].reverse()
  const material = materialBalance(game)
  const evaluation = engineLine.mate !== null ? `M${Math.abs(engineLine.mate)}` : `${engineLine.score >= 0 ? '+' : ''}${(engineLine.score / 100).toFixed(1)}`
  const whiteChance = whiteWinningChance(engineLine.score, engineLine.mate)
  const arrow = mode === 'analysis' && engineLine.bestUci ? bestMoveArrowPoints(engineLine.bestUci, orientation) : null
  const resultTitle = game.isCheckmate() ? 'Checkmate' : game.isDraw() ? 'Draw' : null
  const movePairs: [string, string?][] = []
  for (let index = 0; index < history.length; index += 2) movePairs.push([history[index], history[index + 1]])

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Stockbot home">
          <span className="brand-mark"><span>♞</span></span>
          <span className="brand-name">stock<span>bot</span></span>
        </a>
        <div className="topbar-center"><span className="eyebrow">YOUR CHESS COMPANION</span><span className="topbar-divider" /><span className="topbar-note">Think out loud.</span></div>
        <div className="engine-status"><span className={`status-dot ${engineReady ? 'ready' : ''}`} /><span>{engineReady ? `FULL ENGINE · ${engineThreads} THREADS` : 'LOADING FULL ENGINE'}</span><span className="status-version">SF 19</span></div>
      </header>

      <div className="workspace">
        <section className="play-area">
          <div className="section-heading">
            <div>
              <div className="crumb"><span>STOCKBOT</span><span>/</span><span>{mode === 'play' ? 'LIVE GAME' : 'ANALYSIS'}</span></div>
              <h1>{mode === 'play' ? 'Your next move.' : 'The position, unpacked.'}</h1>
            </div>
            <div className="heading-controls">
              {mode === 'play' && <label className="side-choice"><span>PLAY AS</span><select value={humanColor} onChange={(event) => startNewGame(event.target.value as 'w' | 'b')} aria-label="Choose your side"><option value="w">White</option><option value="b">Black</option></select></label>}
              <button className="import-trigger" onClick={() => { setImportError(''); setImportText(''); setImportOpen(true) }}><FileUp size={15} /> Import</button>
              <div className="mode-switch" aria-label="Game mode">
                <button className={mode === 'play' ? 'active' : ''} onClick={() => changeMode('play')}><Swords size={15} /> Play</button>
                <button className={mode === 'analysis' ? 'active' : ''} onClick={() => changeMode('analysis')}><Gauge size={15} /> Analysis</button>
              </div>
            </div>
          </div>

          <div className="board-layout">
            <div className="board-column">
              <div className="player-row opponent-row">
                <div className="player-avatar bot-avatar"><span>♞</span></div>
                <div className="player-ident"><strong>{mode === 'play' ? 'Stockbot' : 'Black'}</strong><span>{mode === 'play' ? `Stockfish 19 · ${humanColor === 'w' ? 'Black' : 'White'}` : 'Analysis board'}</span></div>
                <div className="player-material">{material < 0 ? '−'.repeat(Math.min(Math.abs(material), 3)) : ''}</div>
              </div>

              <div className="board-wrap" aria-label="Chess board">
                <div className="eval-rail" aria-label={`Evaluation ${evaluation}; White expected score ${Math.round(whiteChance)} percent`}><div className="eval-black" style={{ height: `${100 - whiteChance}%` }} /><span className="eval-score">{evaluation}</span></div>
                <div className="chessboard">
                  {boardRows.map((rank, rowIndex) => boardFiles.map((file, columnIndex) => {
                    const square = `${file}${rank + 1}` as Square
                    const piece = game.get(square)
                    const isLight = (rank + columnIndex) % 2 === 1
                    const isLast = lastMove?.includes(square) ?? false
                    const isTarget = legalTargets.includes(square)
                    const isCapture = isTarget && Boolean(piece)
                    return (
                      <button
                        className={`square ${isLight ? 'light' : 'dark'} ${selected === square ? 'selected' : ''} ${isLast ? 'last-move' : ''} ${isTarget ? 'legal-target' : ''} ${isCapture ? 'capture-target' : ''} ${draggingSquare === square ? 'drag-source' : ''} ${dragTarget === square ? 'drag-target' : ''}`}
                        key={square}
                        data-square={square}
                        onClick={() => handleSquare(square)}
                        disabled={resigned || game.isGameOver() || (mode === 'play' && game.turn() !== humanColor)}
                        aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
                      >
                        {piece && <span className={`piece ${piece.color === 'w' ? 'piece-white' : 'piece-black'}`} data-glyph={PIECES[`${piece.color}${piece.type}`]}>{PIECES[`${piece.color}${piece.type}`]}</span>}
                        {isTarget && !piece && <span className="move-dot" />}
                        {columnIndex === 0 && <span className="coordinate rank-coordinate">{rank + 1}</span>}
                        {rowIndex === 7 && <span className="coordinate file-coordinate">{file}</span>}
                      </button>
                    )
                  }))}
                  {arrow && <svg className="best-move-arrow" viewBox="0 0 8 8" role="img" aria-label={`Stockfish recommends ${engineLine.bestMove}`}>
                    <defs>
                      <linearGradient id="stockbot-arrow-gradient" x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#e99558" />
                        <stop offset="55%" stopColor="#f3d45b" />
                        <stop offset="100%" stopColor="#fff1a4" />
                      </linearGradient>
                      <filter id="stockbot-arrow-glow" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                        <feGaussianBlur stdDeviation="0.055" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                      <marker id="stockbot-arrow-head" viewBox="0 0 10 10" refX="8.4" refY="5" markerWidth="0.4" markerHeight="0.4" orient="auto">
                        <path d="M 0 0.8 L 9.2 5 L 0 9.2 Q 2.5 5 0 0.8 Z" />
                      </marker>
                    </defs>
                    <circle className="best-move-origin" cx={arrow.x1} cy={arrow.y1} r="0.24" />
                    <path className="best-move-arrow-shadow" d={arrow.path} />
                    <path className="best-move-arrow-line" d={arrow.path} markerEnd="url(#stockbot-arrow-head)" />
                    <path className="best-move-arrow-trail" d={arrow.path} pathLength="1" />
                    <circle className="best-move-target" cx={arrow.x2} cy={arrow.y2} r="0.3" />
                  </svg>}
                  {resultTitle && <div className="game-result-overlay" role="status" aria-live="polite">
                    <div className="game-result-card"><span>GAME OVER</span><strong>{resultTitle}</strong><em>{game.isCheckmate() ? `${game.turn() === 'w' ? 'Black' : 'White'} wins` : game.isStalemate() ? 'Stalemate' : 'The game is drawn'}</em><button onClick={() => startNewGame()}>New game</button></div>
                  </div>}
                </div>
              </div>

              <div className="player-row user-row">
                <div className="player-avatar user-avatar"><span>{humanColor === 'w' ? '♙' : '♟'}</span></div>
                <div className="player-ident"><strong>You</strong><span>{humanColor === 'w' ? 'White' : 'Black'} · {mode === 'play' ? 'Your turn' : 'Exploring'}</span></div>
                <div className="player-material">{material > 0 ? '+'.repeat(Math.min(material, 3)) : ''}</div>
              </div>

              <div className="board-toolbar">
                <div className="turn-status"><span className={`turn-pip ${game.turn() === 'w' ? 'white-pip' : 'black-pip'}`} />{resigned ? 'Game resigned. Start a new game.' : positionLabel(game)}</div>
                <div className="board-actions">
                  <button className="icon-button" aria-label="Undo move" title="Undo move" onClick={undoMove} disabled={!history.length}><ArrowLeft size={17} /></button>
                  <button className="icon-button" aria-label="Redo unavailable" title="Redo" disabled><ArrowRight size={17} /></button>
                  <span className="action-divider" />
                  <button className="icon-button" aria-label="Flip board" title="Flip board" onClick={() => setOrientation((current) => current === 'w' ? 'b' : 'w')}><ArrowDownUp size={16} /></button>
                  <button className="icon-button" aria-label="New game" title="New game" onClick={() => startNewGame()}><RotateCcw size={16} /></button>
                  {mode === 'play' && <button className="icon-button resign-button" aria-label="Resign" title="Resign" onClick={() => { setResigned(true); setMessages((current) => [...current, { role: 'assistant', text: 'Game resigned. Stockbot wins this one. Ready for a rematch whenever you are.' }]) }}><Flag size={15} /></button>}
                </div>
              </div>
            </div>

            <aside className="position-panel">
              <div className="panel-tabs">
                <button className={activeTab === 'moves' ? 'selected-tab' : ''} onClick={() => setActiveTab('moves')}><SquarePen size={14} /> Moves</button>
                <button className={activeTab === 'details' ? 'selected-tab' : ''} onClick={() => setActiveTab('details')}><CircleHelp size={14} /> Position</button>
              </div>
              {activeTab === 'moves' ? (
                <>
                  <div className="moves-heading"><span>MOVE</span><span>WHITE</span><span>BLACK</span></div>
                  <div className="move-list">
                    {movePairs.length ? movePairs.map(([white, black], index) => (
                      <div className={`move-row ${index === movePairs.length - 1 ? 'latest-move' : ''}`} key={`${white ?? 'x'}-${black ?? 'x'}-${index}`}>
                        <span className="move-number">{index + 1}.</span>
                        <span className="move-cell"><span>{white}</span></span>
                        <span className="move-cell"><span>{black ?? ''}</span></span>
                      </div>
                    )) : <div className="empty-moves"><span className="empty-knight">♘</span><span>The board is yours.</span><span>Make a move to begin.</span></div>}
                  </div>
                  <div className="opening-note"><span className="opening-icon">✳</span><div><span>OPENING</span><strong>{openingName(history) ?? 'Unclassified'}</strong></div><ChevronDown size={15} /></div>
                </>
              ) : (
                <div className="position-details">
                  <div className="detail-stat"><span>POSITION</span><strong>{game.isCheckmate() ? 'Checkmate' : game.isDraw() ? 'Draw' : game.isCheck() ? 'Check' : 'In play'}</strong></div>
                  <div className="detail-stat"><span>TO MOVE</span><strong>{game.turn() === 'w' ? 'White' : 'Black'}</strong></div>
                  <div className="detail-stat"><span>MATERIAL</span><strong>{material === 0 ? 'Equal' : `${material > 0 ? 'White' : 'Black'} +${Math.abs(material)}`}</strong></div>
                  <div className="detail-stat"><span>FEN</span><code>{fen}</code></div>
                  <button className="copy-fen" onClick={() => navigator.clipboard?.writeText(fen)}>Copy FEN</button>
                </div>
              )}
              <div className="engine-card">
                <div className="engine-card-top"><div className="engine-card-icon"><Zap size={15} /></div><span>ENGINE INSIGHT</span><span className="engine-depth">{engineLine.depth ? `D${engineLine.depth}` : '—'}</span></div>
                <div className="engine-evaluation"><strong>{evaluation}</strong><span>{thinking ? 'Thinking through it…' : 'Position evaluation'}</span></div>
                <div className="best-move"><span>BEST MOVE</span><strong>{engineLine.bestMove || 'Calculating'}</strong><span className="best-line">{engineLine.line.slice(1).join(' · ') || (engineReady ? '—' : 'Starting engine')}</span></div>
              </div>
              <button className="analyze-link" onClick={() => sendMessage('What is the best move here?')}><Sparkles size={15} /> Ask about this position <ArrowRight size={15} /></button>
            </aside>
          </div>

          <div className="below-board-note"><span className="note-line" />{mode === 'play' ? 'Play a move. We’ll figure out the rest together.' : 'Explore a line. The engine will follow along.'}</div>
        </section>

        <aside className="chat-panel">
          <div className="chat-header">
            <div className="chat-title"><div className="chat-avatar"><MessageCircle size={19} /></div><div><h2>Chat anything</h2><span><span className={`chat-online ${chatStatus === 'ready' ? '' : 'offline'}`} />{chatStatus === 'ready' ? 'Qwen 3 · on device' : chatStatus === 'checking' ? 'Connecting locally' : 'Local model unavailable'}</span></div></div>
            <button className="icon-button chat-menu" title="New conversation" aria-label="New conversation" onClick={() => { chatRequestId.current += 1; setChatThinking(false); setMessages([INITIAL_MESSAGE]) }}><SquarePen size={16} /></button>
          </div>
          <div className="conversation-context"><span className="context-pin" /><span>FOLLOWING THIS BOARD</span><span className="context-divider" /><span>{history.length ? `${Math.ceil(history.length / 2)} MOVES` : 'START POSITION'}</span></div>
          <div className="chat-messages">
            <div className="date-marker"><span />TODAY<span /></div>
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                {message.role === 'assistant' && <div className="message-avatar">♞</div>}
                <div className="message-body">
                  {message.role === 'assistant' && <span className="message-name">STOCKBOT <span>·</span> {index === 0 ? 'JUST NOW' : 'POSITION-AWARE'}</span>}
                  <div className="message-bubble">{message.text}</div>
                </div>
              </div>
            ))}
            {chatThinking && <div className="thinking-indicator"><span /><span /><span /><small>Stockbot is thinking</small></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="quick-prompts"><span className="prompt-label">TRY ASKING</span><div className="prompt-list">
            <button disabled={chatThinking} onClick={() => sendMessage('What is the best move here?')}>Best move?</button>
            <button disabled={chatThinking} onClick={() => sendMessage('Who is winning?')}>Who’s better?</button>
            <button disabled={chatThinking} onClick={() => sendMessage('What opening is this?')}>Name this opening</button>
          </div></div>
          <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); sendMessage() }}>
            <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask anything about the game…" aria-label="Message Stockbot" />
            <button type="submit" disabled={!draft.trim() || chatThinking} aria-label="Send message"><Send size={17} /></button>
            <div className="composer-footer"><span><Sparkles size={12} /> LOCAL MODEL · STOCKFISH CONTEXT</span><span>ENTER ↵</span></div>
          </form>
          <div className="chat-footnote"><span>♞</span>Built for the love of the game.</div>
        </aside>
      </div>
      {draggingSquare && dragPosition && (() => {
        const piece = game.get(draggingSquare)
        return piece ? <span className={`piece piece-drag-preview ${piece.color === 'w' ? 'piece-white' : 'piece-black'}`} data-glyph={PIECES[`${piece.color}${piece.type}`]} style={{ left: dragPosition.x, top: dragPosition.y }} aria-hidden="true">{PIECES[`${piece.color}${piece.type}`]}</span> : null
      })()}
      {importOpen && <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setImportOpen(false) }}>
        <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" onKeyDown={(event) => { if (event.key === 'Escape') setImportOpen(false) }}>
          <div className="import-dialog-header"><div><span className="crumb">BOARD TOOLS / IMPORT</span><h2 id="import-title">Bring a position in.</h2></div><button className="icon-button" aria-label="Close import" onClick={() => setImportOpen(false)}><X size={17} /></button></div>
          <p className="import-description">Paste a FEN position or a PGN game. Imported games open in analysis mode.</p>
          <div className="import-format-switch" role="tablist" aria-label="Import format">
            <button role="tab" aria-selected={importFormat === 'fen'} className={importFormat === 'fen' ? 'active' : ''} onClick={() => { setImportFormat('fen'); setImportError('') }}>FEN position</button>
            <button role="tab" aria-selected={importFormat === 'pgn'} className={importFormat === 'pgn' ? 'active' : ''} onClick={() => { setImportFormat('pgn'); setImportError('') }}>PGN game</button>
          </div>
          <textarea className="import-textarea" value={importText} onChange={(event) => { setImportText(event.target.value); setImportError('') }} placeholder={importFormat === 'fen' ? 'Paste FEN, e.g. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : '[Event "Casual Game"]\n\n1. e4 e5 2. Nf3 Nc6'} aria-label={`Paste ${importFormat.toUpperCase()}`} />
          {importError && <p className="import-error" role="alert">{importError}</p>}
          <div className="import-dialog-footer"><span>{importFormat === 'fen' ? 'Loads a single board position.' : 'Loads the full game and move history.'}</span><button className="import-submit" onClick={importPosition}>Load {importFormat.toUpperCase()} <ArrowRight size={15} /></button></div>
        </section>
      </div>}
      <footer className="page-footer"><span>STOCKBOT <span className="footer-dot">·</span> STOCKFISH 19 <span className="footer-dot">·</span> <a href="/engine/COPYING.txt" target="_blank" rel="noreferrer">GPLv3</a></span><span>Every position has a story.</span><span><Crown size={12} /> Play thoughtfully</span></footer>
    </main>
  )
}

export default App