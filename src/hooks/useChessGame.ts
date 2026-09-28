import { useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import type { ImportFormat, Mode, MoveSnapshot, PendingPromotion, PromotionPiece } from '../types/chess'
import { enginePositionCommand } from '../lib/stockfish'

function snapshot(move: MoveSnapshot): MoveSnapshot {
  return { from: move.from, to: move.to, promotion: move.promotion, color: move.color, san: move.san }
}

export function useChessGame() {
  const gameRef = useRef(new Chess())
  const baseFenRef = useRef(gameRef.current.fen())
  const timelineRef = useRef<MoveSnapshot[]>([])
  const cursorRef = useRef(0)
  const [fen, setFen] = useState(gameRef.current.fen())
  const [history, setHistory] = useState<string[]>([])
  const [cursor, setCursor] = useState(0)
  const [selected, setSelected] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<[Square, Square] | null>(null)
  const [orientation, setOrientation] = useState<'w' | 'b'>('w')
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [canRedo, setCanRedo] = useState(false)
  const publish = () => {
    const currentGame = gameRef.current
    setFen(currentGame.fen())
    setHistory(timelineRef.current.map((move) => move.san))
    setCursor(cursorRef.current)
    setCanRedo(cursorRef.current < timelineRef.current.length)
    const latest = timelineRef.current[cursorRef.current - 1]
    setLastMove(latest ? [latest.from, latest.to] : null)
    setSelected(null)
    setLegalTargets([])
  }

  const recordMove = (move: MoveSnapshot) => {
    timelineRef.current = timelineRef.current.slice(0, cursorRef.current)
    timelineRef.current.push(snapshot(move))
    cursorRef.current += 1
    publish()
  }

  const navigateTo = (ply: number) => {
    const nextCursor = Math.max(0, Math.min(timelineRef.current.length, ply))
    const restoredGame = new Chess(baseFenRef.current)
    try {
      for (const move of timelineRef.current.slice(0, nextCursor)) {
        restoredGame.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) })
      }
    } catch {
      return false
    }
    gameRef.current = restoredGame
    cursorRef.current = nextCursor
    setPendingPromotion(null)
    publish()
    return true
  }

  const select = (square: Square | null) => {
    const game = gameRef.current
    setSelected(square)
    setLegalTargets(square ? game.moves({ square, verbose: true }).map((move) => move.to) : [])
  }

  const isPromotionMove = (from: Square, to: Square) => {
    const piece = gameRef.current.get(from)
    return piece?.type === 'p' && (to[1] === '1' || to[1] === '8')
  }

  const attemptMove = (from: Square, to: Square): 'moved' | 'promotion' | 'invalid' => {
    const game = gameRef.current
    if (from === to || game.isGameOver() || !game.moves({ square: from, verbose: true }).some((move) => move.to === to)) return 'invalid'
    if (isPromotionMove(from, to)) {
      const piece = game.get(from)
      if (!piece) return 'invalid'
      setPendingPromotion({ from, to, color: piece.color })
      return 'promotion'
    }
    try {
      const move = game.move({ from, to })
      recordMove(move)
      return 'moved'
    } catch {
      return 'invalid'
    }
  }

  const choosePromotion = (promotion: PromotionPiece) => {
    if (!pendingPromotion) return false
    try {
      const move = gameRef.current.move({ ...pendingPromotion, promotion })
      setPendingPromotion(null)
      recordMove(move)
      return true
    } catch {
      return false
    }
  }

  const cancelPromotion = () => setPendingPromotion(null)

  const playEngineMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    try {
      const move = gameRef.current.move({ from, to, ...(promotion ? { promotion } : {}) })
      recordMove(move)
      return true
    } catch {
      return false
    }
  }

  const undo = (mode: Mode, humanColor: 'w' | 'b') => {
    setPendingPromotion(null)
    if (cursorRef.current === 0) return false
    let count = 1
    const lastMove = timelineRef.current[cursorRef.current - 1]
    if (mode === 'play' && lastMove.color !== humanColor && cursorRef.current > 1) count = 2
    return navigateTo(cursorRef.current - count)
  }

  const redo = (mode: Mode, humanColor: 'w' | 'b') => {
    if (cursorRef.current >= timelineRef.current.length) return false
    let count = 1
    const nextMove = timelineRef.current[cursorRef.current]
    const replyMove = timelineRef.current[cursorRef.current + 1]
    if (mode === 'play' && nextMove.color === humanColor && replyMove && replyMove.color !== humanColor) count = 2
    return navigateTo(cursorRef.current + count)
  }

  const newGame = (color: 'w' | 'b' = 'w') => {
    gameRef.current = new Chess()
    baseFenRef.current = gameRef.current.fen()
    timelineRef.current = []
    cursorRef.current = 0
    setOrientation(color)
    setPendingPromotion(null)
    setFen(gameRef.current.fen())
    setHistory([])
    setCursor(0)
    setLastMove(null)
    setSelected(null)
    setLegalTargets([])
  }

  const importGame = (format: ImportFormat, source: string) => {
    const imported = new Chess()
    try {
      if (format === 'fen') {
        const fields = source.trim().split(/\s+/)
        if (fields.length !== 6) return { ok: false as const, error: 'A FEN must contain six fields: board, turn, castling, en passant, halfmove, and fullmove.' }
        imported.load(source.trim())
      } else {
        if (!source.trim()) return { ok: false as const, error: 'Paste a PGN game first.' }
        imported.loadPgn(source, { strict: true })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The notation could not be parsed.'
      return { ok: false as const, error: format === 'fen' ? `Invalid FEN: ${message}` : `Invalid PGN: ${message}` }
    }
    const headers = imported.getHeaders()
    const initialFen = new Chess().fen()
    const startingFen = format === 'fen' ? source.trim() : headers.SetUp === '1' && headers.FEN ? headers.FEN : initialFen
    gameRef.current = imported
    baseFenRef.current = startingFen
    timelineRef.current = imported.history({ verbose: true }).map(snapshot)
    cursorRef.current = timelineRef.current.length
    setPendingPromotion(null)
    publish()
    return { ok: true as const, headers }
  }

  return {
    game: gameRef.current,
    gameRef,
    baseFenRef,
    fen,
    history,
    cursor,
    selected,
    legalTargets,
    lastMove,
    orientation,
    pendingPromotion,
    canUndo: cursor > 0,
    canRedo,
    setOrientation,
    select,
    attemptMove,
    choosePromotion,
    cancelPromotion,
    playEngineMove,
    undo,
    redo,
    navigateTo,
    newGame,
    importGame,
    publish,
    enginePositionCommand: () => enginePositionCommand(gameRef.current, baseFenRef.current),
  }
}