import { useEffect, useRef, useState } from 'react'
import type { Square } from 'chess.js'
import { ArrowDownUp, ArrowLeft, ArrowRight, Crown, FileUp, Flag, Gauge, RotateCcw, Swords } from 'lucide-react'
import { ChatPanel } from './components/ChatPanel'
import { ChessBoard } from './components/ChessBoard'
import { ImportModal } from './components/ImportModal'
import { PositionPanel } from './components/PositionPanel'
import { PromotionPicker } from './components/PromotionPicker'
import { useChessGame } from './hooks/useChessGame'
import { useChat } from './hooks/useChat'
import { useGameReview } from './hooks/useGameReview'
import { useStockfish } from './hooks/useStockfish'
import { evaluationForPosition, upsertEvaluationPoint } from './lib/stockfish'
import { materialBalance, positionLabel } from './lib/chess'
import { PIECE_GLYPHS } from './lib/pieces'
import { EMPTY_ENGINE_LINE, type EvaluationPoint, type ImportFormat, type Mode, type PromotionPiece } from './types/chess'

type DragPointer = { pointerId: number; from: Square; startX: number; startY: number; moved: boolean }
type PointerPosition = { x: number; y: number }

function App() {
  const chess = useChessGame()
  const { game, gameRef, fen, history, orientation, selected, legalTargets, lastMove, pendingPromotion } = chess
  const [mode, setMode] = useState<Mode>('play')
  const [humanColor, setHumanColor] = useState<'w' | 'b'>('w')
  const modeRef = useRef(mode)
  const humanColorRef = useRef(humanColor)
  const resignedRef = useRef(false)
  const stockfishRef = useRef<ReturnType<typeof useStockfish> | null>(null)
  const delayedEngineMoveRef = useRef<number | null>(null)
  const delayedAnalysisRef = useRef<number | null>(null)
  const suppressClickTimerRef = useRef<number | null>(null)
  const dragPointerRef = useRef<DragPointer | null>(null)
  const dragTargetRef = useRef<Square | null>(null)
  const suppressClickRef = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [draggingSquare, setDraggingSquare] = useState<Square | null>(null)
  const [dragTarget, setDragTarget] = useState<Square | null>(null)
  const [dragPosition, setDragPosition] = useState<PointerPosition | null>(null)
  const [resigned, setResigned] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importFormat, setImportFormat] = useState<ImportFormat>('fen')
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [evaluationHistory, setEvaluationHistory] = useState<EvaluationPoint[]>([])

  modeRef.current = mode
  humanColorRef.current = humanColor
  resignedRef.current = resigned

  const clearDeferredActions = () => {
    if (delayedEngineMoveRef.current !== null) window.clearTimeout(delayedEngineMoveRef.current)
    if (delayedAnalysisRef.current !== null) window.clearTimeout(delayedAnalysisRef.current)
    delayedEngineMoveRef.current = null
    delayedAnalysisRef.current = null
  }

  const stockfish = useStockfish({
    getCurrentFen: () => gameRef.current.fen(),
    onBestMove: (position, uciMove) => {
      if (position !== gameRef.current.fen() || modeRef.current !== 'play' || gameRef.current.turn() === humanColorRef.current || resignedRef.current) return
      const promotion = uciMove[4] as PromotionPiece | undefined
      if (!chess.playEngineMove(uciMove.slice(0, 2) as Square, uciMove.slice(2, 4) as Square, promotion)) return
      if (!gameRef.current.isGameOver()) {
        clearDeferredActions()
        const resultingFen = gameRef.current.fen()
        delayedAnalysisRef.current = window.setTimeout(() => {
          delayedAnalysisRef.current = null
          if (modeRef.current !== 'play' || gameRef.current.fen() !== resultingFen) return
          const currentGame = gameRef.current
          stockfishRef.current?.analyze(currentGame.fen(), chess.enginePositionCommand())
        }, 0)
      }
    },
  })
  stockfishRef.current = stockfish
  const {
    ready: engineReady, thinking, threads: engineThreads, line: engineLine, candidates: engineCandidates,
    settings: engineSettings, multithreaded: engineMultithreaded, error: engineError,
  } = stockfish
  const boardEvaluation = evaluationForPosition(evaluationHistory, fen, chess.cursor, engineLine)
  const chatContextKey = JSON.stringify([
    fen, history, mode, humanColor, engineLine.fen, engineLine.score, engineLine.mate,
    engineLine.depth, engineLine.bestMove, engineLine.line,
  ])

  const analyze = (position = gameRef.current.fen()) => {
    const currentGame = gameRef.current
    const command = currentGame.fen() === position ? chess.enginePositionCommand() : `position fen ${position}`
    stockfish.analyze(position, command)
  }
  const askEngineToMove = (position = gameRef.current.fen()) => stockfish.playBestMove(position, chess.enginePositionCommand())
  const chat = useChat({
    contextKey: chatContextKey,
    getGame: () => gameRef.current,
    getEngineLine: () => stockfishRef.current?.line ?? EMPTY_ENGINE_LINE,
    getMode: () => modeRef.current,
    getHumanColor: () => humanColorRef.current,
  })
  const review = useGameReview({
    getPositions: chess.getReviewPositions,
    analyze: stockfish.analyzeAsync,
    stopAnalysis: stockfish.stop,
    reanalyzeCurrent: () => analyze(),
    recordEvaluation: (point) => setEvaluationHistory((previous) => upsertEvaluationPoint(previous, point)),
    engineReady,
    depth: engineSettings.depth,
  })
  const { reviewedMoves, summary: reviewSummary, progress: reviewProgress, error: reviewError } = review
  const continueAfterMove = () => {
    const currentGame = gameRef.current
    if (currentGame.isGameOver()) stockfish.stop()
    else if (modeRef.current === 'play' && currentGame.turn() !== humanColorRef.current) askEngineToMove(currentGame.fen())
    else analyze(currentGame.fen())
  }

  const refreshEngineRef = useRef<() => void>(() => {})
  refreshEngineRef.current = () => {
    const currentGame = gameRef.current
    if (modeRef.current === 'play' && currentGame.turn() !== humanColorRef.current) askEngineToMove(currentGame.fen())
    else analyze(currentGame.fen())
  }

  useEffect(() => {
    if (engineReady) refreshEngineRef.current()
  }, [engineReady, engineSettings.depth, engineSettings.moveTime, engineSettings.threads, engineSettings.hash, engineSettings.multiPv])

  useEffect(() => {
    if (engineLine.fen !== fen || engineLine.score === null && engineLine.mate === null) return
    setEvaluationHistory((previous) => {
      const point: EvaluationPoint = { ply: chess.cursor, fen, score: engineLine.score ?? (engineLine.mate && engineLine.mate > 0 ? 10000 : -10000), mate: engineLine.mate, source: 'live' }
      return upsertEvaluationPoint(previous, point)
    })
  }, [engineLine, fen, chess.cursor])

  const movePiece = (from: Square, to: Square) => {
    const currentGame = gameRef.current
    if (from === to || resignedRef.current || currentGame.isGameOver() || (modeRef.current === 'play' && currentGame.turn() !== humanColorRef.current)) return false
    const result = chess.attemptMove(from, to)
    if (result === 'invalid') return false
    clearDeferredActions()
    if (result === 'promotion') return true
    if (reviewProgress) stockfish.stop()
    review.clear()
    const currentPositions = chess.getReviewPositions()
    setEvaluationHistory((previous) => previous.filter((point) => currentPositions.some((position) => position.ply === point.ply && position.fen === point.fen)))
    continueAfterMove()
    return true
  }

  const pointerActionsRef = useRef({ chess, gameRef, movePiece })
  pointerActionsRef.current = { chess, gameRef, movePiece }

  useEffect(() => {
    const findSquare = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('.square[data-square]')?.dataset.square as Square | undefined
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const square = findSquare(event.clientX, event.clientY)
      const { gameRef: currentGameRef } = pointerActionsRef.current
      const currentGame = currentGameRef.current
      const piece = square && currentGame.get(square)
      if (!square || !piece || resignedRef.current || currentGame.isGameOver()) return
      if (modeRef.current === 'play' && (piece.color !== humanColorRef.current || currentGame.turn() !== humanColorRef.current)) return
      dragTargetRef.current = null
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
      const target = findSquare(event.clientX, event.clientY) ?? null
      dragTargetRef.current = target
      setDragTarget(target)
    }
    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragPointerRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragPointerRef.current = null
      if (!drag.moved) return
      event.preventDefault()
      const target = findSquare(event.clientX, event.clientY) ?? dragTargetRef.current
      dragTargetRef.current = null
      const actions = pointerActionsRef.current
      if (!target || !actions.movePiece(drag.from, target)) actions.chess.select(drag.from)
      setDraggingSquare(null)
      setDragTarget(null)
      setDragPosition(null)
      suppressClickRef.current = true
      if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current)
      suppressClickTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false
        suppressClickTimerRef.current = null
      }, 50)
    }
    const handlePointerCancel = (event: PointerEvent) => {
      if (dragPointerRef.current?.pointerId !== event.pointerId) return
      dragPointerRef.current = null
      dragTargetRef.current = null
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
      clearDeferredActions()
      if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current)
      suppressClickTimerRef.current = null
    }
  }, [])

  const handleSquare = (square: Square) => {
    if (suppressClickRef.current || resigned || game.isGameOver()) return
    const piece = game.get(square)
    if (selected && legalTargets.includes(square) && movePiece(selected, square)) return
    if (piece && (mode === 'analysis' || piece.color === humanColor)) chess.select(square)
    else chess.select(null)
  }

  const startNewGame = (color = humanColor) => {
    clearDeferredActions()
    stockfish.stop()
    review.clear()
    chat.reset()
    setEvaluationHistory([])
    chess.newGame(color)
    setHumanColor(color)
    setResigned(false)
    if (modeRef.current === 'play' && color === 'b') {
      const startingFen = gameRef.current.fen()
      delayedEngineMoveRef.current = window.setTimeout(() => {
        delayedEngineMoveRef.current = null
        if (modeRef.current === 'play' && gameRef.current.fen() === startingFen && gameRef.current.turn() !== humanColorRef.current) {
          askEngineToMove(startingFen)
        }
      }, 120)
    } else analyze(gameRef.current.fen())
  }

  const changeMode = (nextMode: Mode) => {
    clearDeferredActions()
    stockfish.stop()
    review.clear()
    modeRef.current = nextMode
    setMode(nextMode)
    setResigned(false)
    if (nextMode === 'analysis') {
      chat.addAssistantMessage('Analysis mode on. Explore any legal continuation; I’ll keep evaluating the position as it changes.')
      analyze(gameRef.current.fen())
    } else {
      startNewGame(humanColor)
      chat.addAssistantMessage(`Fresh game. You’re ${humanColor === 'w' ? 'White' : 'Black'}; I’ll play the other side.`)
    }
  }

  const undoMove = () => {
    clearDeferredActions()
    stockfish.stop()
    review.clear()
    if (chess.undo(mode, humanColor)) {
      setResigned(false)
      continueAfterMove()
    }
  }
  const redoMove = () => {
    clearDeferredActions()
    stockfish.stop()
    review.clear()
    if (chess.redo(mode, humanColor)) {
      setResigned(false)
      continueAfterMove()
    }
  }
  const navigateHistory = (ply: number) => {
    clearDeferredActions()
    stockfish.stop()
    review.clear()
    modeRef.current = 'analysis'
    setMode('analysis')
    setResigned(false)
    if (chess.navigateTo(ply)) analyze(gameRef.current.fen())
  }
  const selectPromotion = (piece: PromotionPiece) => {
    if (chess.choosePromotion(piece)) {
      clearDeferredActions()
      stockfish.stop()
      review.clear()
      const currentPositions = chess.getReviewPositions()
      setEvaluationHistory((previous) => previous.filter((point) => currentPositions.some((position) => position.ply === point.ply && position.fen === point.fen)))
      continueAfterMove()
    }
  }

  const sendMessage = (text = chat.draft) => {
    void chat.send(text)
    inputRef.current?.focus()
  }

  const importPosition = () => {
    const source = importText.trim()
    const result = chess.importGame(importFormat, source)
    if (!result.ok) {
      setImportError(result.error)
      return
    }
    clearDeferredActions()
    stockfish.stop()
    review.clear()
    setEvaluationHistory([])
    modeRef.current = 'analysis'
    setMode('analysis')
    setResigned(false)
    chess.setOrientation(humanColor)
    setImportError('')
    setImportOpen(false)
    chat.addAssistantMessage(`${importFormat.toUpperCase()} loaded. We’re now analyzing the imported position.`)
    analyze(gameRef.current.fen())
  }

  const resign = () => {
    if (resignedRef.current || gameRef.current.isGameOver()) return
    clearDeferredActions()
    stockfish.stop()
    review.clear()
    setResigned(true)
    chat.addAssistantMessage('Game resigned. ChessChat wins this one. Ready for a rematch whenever you are.')
  }

  const material = materialBalance(game)

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="ChessChat home"><span className="brand-mark"><span>♞</span></span><span className="brand-name">Chess<span>Chat</span></span></a>
        <div className="topbar-center"><span className="eyebrow">YOUR CHESS COMPANION</span><span className="topbar-divider" /><span className="topbar-note">Think out loud.</span></div>
        <div className="engine-status"><span className={`status-dot ${engineReady ? 'ready' : ''}`} /><span>{engineError ?? (engineReady ? engineMultithreaded ? `FULL ENGINE · ${engineThreads} THREADS` : 'FULL ENGINE · SINGLE THREAD' : 'LOADING FULL ENGINE')}</span><span className="status-version">SF 19</span></div>
      </header>

      <div className="workspace">
        <section className="play-area">
          <div className="section-heading">
            <div><div className="crumb"><span>CHESSCHAT</span><span>/</span><span>{mode === 'play' ? 'LIVE GAME' : 'ANALYSIS'}</span></div><h1>{mode === 'play' ? 'Your next move.' : 'The position, unpacked.'}</h1></div>
            <div className="heading-controls">
              {mode === 'play' && <label className="side-choice"><span>PLAY AS</span><select value={humanColor} onChange={(event) => startNewGame(event.target.value as 'w' | 'b')} aria-label="Choose your side"><option value="w">White</option><option value="b">Black</option></select></label>}
              <button className="import-trigger" onClick={() => { setImportError(''); setImportText(''); setImportOpen(true) }}><FileUp size={15} /> Import</button>
              <div className="mode-switch" aria-label="Game mode"><button className={mode === 'play' ? 'active' : ''} onClick={() => changeMode('play')}><Swords size={15} /> Play</button><button className={mode === 'analysis' ? 'active' : ''} onClick={() => changeMode('analysis')}><Gauge size={15} /> Analysis</button></div>
            </div>
          </div>

          <div className="board-layout">
            <div className="board-column">
              <ChessBoard game={game} material={material} orientation={orientation} mode={mode} humanColor={humanColor} selected={selected} legalTargets={legalTargets} lastMove={lastMove} draggingSquare={draggingSquare} dragTarget={dragTarget} resigned={resigned} engineLine={engineLine} evaluation={boardEvaluation} onSquare={handleSquare} onNewGame={() => startNewGame()} />
              <div className="board-toolbar">
                <div className="turn-status"><span className={`turn-pip ${game.turn() === 'w' ? 'white-pip' : 'black-pip'}`} />{resigned ? 'Game resigned. Start a new game.' : positionLabel(game)}</div>
                <div className="board-actions">
                  <button className="icon-button" aria-label="Undo move" title="Undo move" onClick={undoMove} disabled={!chess.canUndo}><ArrowLeft size={17} /></button>
                  <button className="icon-button" aria-label="Redo move" title="Redo move" onClick={redoMove} disabled={!chess.canRedo}><ArrowRight size={17} /></button>
                  <span className="action-divider" />
                  <button className="icon-button" aria-label="Flip board" title="Flip board" onClick={() => chess.setOrientation((current) => current === 'w' ? 'b' : 'w')}><ArrowDownUp size={16} /></button>
                  <button className="icon-button" aria-label="New game" title="New game" onClick={() => startNewGame()}><RotateCcw size={16} /></button>
                  {mode === 'play' && <button className="icon-button resign-button" aria-label="Resign" title="Resign" onClick={resign} disabled={game.isGameOver() || resigned}><Flag size={15} /></button>}
                </div>
              </div>
            </div>
            <PositionPanel
              game={game} mode={mode} fen={fen} history={history} cursor={chess.cursor} material={material} engineLine={engineLine}
              engineReady={engineReady} thinking={thinking} candidates={engineCandidates} settings={engineSettings}
              multithreaded={engineMultithreaded}
              evaluationHistory={evaluationHistory} reviewedMoves={reviewedMoves} reviewProgress={reviewProgress}
              reviewSummary={reviewSummary} reviewError={reviewError} onNavigatePly={navigateHistory} onAsk={() => sendMessage('What is the best move here?')}
              onSettingsChange={stockfish.updateSettings} onStopAnalysis={stockfish.stop} onStartReview={() => { void review.start() }}
              onCancelReview={() => {
                review.cancel()
                setEvaluationHistory((previous) => previous.filter((point) => point.source !== 'review'))
              }}
            />
          </div>
          <div className="below-board-note"><span className="note-line" />{mode === 'play' ? 'Play a move. We’ll figure out the rest together.' : 'Explore a line. The engine will follow along.'}</div>
        </section>
        <ChatPanel messages={chat.messages} draft={chat.draft} status={chat.status} thinking={chat.thinking} moveCount={chess.cursor} inputRef={inputRef} onDraftChange={chat.setDraft} onSend={sendMessage} onReset={chat.reset} />
      </div>

      {draggingSquare && dragPosition && (() => {
        const piece = game.get(draggingSquare)
        return piece ? <span className={`piece piece-drag-preview ${piece.color === 'w' ? 'piece-white' : 'piece-black'}`} data-glyph={PIECE_GLYPHS[`${piece.color}${piece.type}`]} style={{ left: dragPosition.x, top: dragPosition.y }} aria-hidden="true">{PIECE_GLYPHS[`${piece.color}${piece.type}`]}</span> : null
      })()}
      {importOpen && <ImportModal format={importFormat} text={importText} error={importError} onFormatChange={(format) => { setImportFormat(format); setImportError('') }} onTextChange={(text) => { setImportText(text); setImportError('') }} onSubmit={importPosition} onClose={() => setImportOpen(false)} />}
      {pendingPromotion && <PromotionPicker color={pendingPromotion.color} onChoose={selectPromotion} onCancel={chess.cancelPromotion} />}
      <footer className="page-footer"><span>CHESSCHAT <span className="footer-dot">·</span> STOCKFISH 19 <span className="footer-dot">·</span> <a href={`${import.meta.env.BASE_URL}engine/COPYING.txt`} target="_blank" rel="noreferrer">GPLv3</a></span><span>Every position has a story.</span><span><Crown size={12} /> Play thoughtfully</span></footer>
    </main>
  )
}

export default App
