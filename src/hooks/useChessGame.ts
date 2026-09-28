import { useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import type { ImportFormat, Mode, MoveSnapshot, PendingPromotion, PromotionPiece } from '../types/chess'
import { enginePositionCommand } from '../lib/stockfish'

function snapshot(move: MoveSnapshot): MoveSnapshot {
  return { from: move.from, to: move.to, promotion: move.promotion }
}

export function useChessGame() {
  const gameRef = useRef(new Chess())
  const baseFenRef = useRef(gameRef.current.fen())
  const redoGroupsRef = useRef<MoveSnapshot[][]>([])
  const [fen, setFen] = useState(gameRef.current.fen())
  const [history, setHistory] = useState<string[]>([])
  const [verboseHistory, setVerboseHistory] = useState<ReturnType<Chess['history']>>([])
  const [selected, setSelected] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<[Square, Square] | null>(null)
  const [orientation, setOrientation] = useState<'w' | 'b'>('w')
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [canRedo, setCanRedo] = useState(false)
  const publish = () => {
    const currentGame = gameRef.current
    setFen(currentGame.fen())
    setHistory(currentGame.history())
    const verbose = currentGame.history({ verbose: true })
    setVerboseHistory(verbose)
    const latest = verbose.at(-1)
    setLastMove(latest ? [latest.from, latest.to] : null)
    setSelected(null)
    setLegalTargets([])
  }

  const clearRedo = () => {
    redoGroupsRef.current = []
    setCanRedo(false)
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
      game.move({ from, to })
      clearRedo()
      publish()
      return 'moved'
    } catch {
      return 'invalid'
    }
  }

  const choosePromotion = (promotion: PromotionPiece) => {
    if (!pendingPromotion) return false
    try {
      gameRef.current.move({ ...pendingPromotion, promotion })
      setPendingPromotion(null)
      clearRedo()
      publish()
      return true
    } catch {
      return false
    }
  }

  const cancelPromotion = () => setPendingPromotion(null)

  const playEngineMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    try {
      gameRef.current.move({ from, to, ...(promotion ? { promotion } : {}) })
      clearRedo()
      publish()
      return true
    } catch {
      return false
    }
  }

  const undo = (mode: Mode, humanColor: 'w' | 'b') => {
    setPendingPromotion(null)
    const game = gameRef.current
    const moves = game.history({ verbose: true })
    if (!moves.length) return false
    let count = 1
    if (mode === 'play' && moves.at(-1)?.color !== humanColor && moves.length > 1) count = 2
    const undone: MoveSnapshot[] = []
    for (let index = 0; index < count; index++) {
      const move = game.undo()
      if (!move) break
      undone.push(snapshot(move))
    }
    if (!undone.length) return false
    redoGroupsRef.current.push(undone.reverse())
    setCanRedo(true)
    publish()
    return true
  }

  const redo = () => {
    const group = redoGroupsRef.current.pop()
    if (!group) return false
    try {
      for (const move of group) gameRef.current.move(move)
    } catch {
      redoGroupsRef.current.push(group)
      return false
    }
    setCanRedo(redoGroupsRef.current.length > 0)
    publish()
    return true
  }

  const newGame = (color: 'w' | 'b' = 'w') => {
    gameRef.current = new Chess()
    baseFenRef.current = gameRef.current.fen()
    clearRedo()
    setOrientation(color)
    setPendingPromotion(null)
    setFen(gameRef.current.fen())
    setHistory([])
    setVerboseHistory([])
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
    clearRedo()
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
    verboseHistory,
    selected,
    legalTargets,
    lastMove,
    orientation,
    pendingPromotion,
    canUndo: history.length > 0,
    canRedo,
    setOrientation,
    select,
    attemptMove,
    choosePromotion,
    cancelPromotion,
    playEngineMove,
    undo,
    redo,
    newGame,
    importGame,
    publish,
    enginePositionCommand: () => enginePositionCommand(gameRef.current, baseFenRef.current),
  }
}