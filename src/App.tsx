import { useEffect, useRef, useState } from 'react'
import type { Square } from 'chess.js'
import { ArrowDownUp, ArrowLeft, ArrowRight, Crown, FileUp, Flag, Gauge, RotateCcw, Swords } from 'lucide-react'
import { ChatPanel, type ChatMessage } from './components/ChatPanel'
import { ChessBoard } from './components/ChessBoard'
import { ImportModal } from './components/ImportModal'
import { PositionPanel } from './components/PositionPanel'
import { PromotionPicker } from './components/PromotionPicker'
import { useChessGame } from './hooks/useChessGame'
import { useStockfish } from './hooks/useStockfish'
import { createEngineContext, engineContextPrompt, materialBalance, positionLabel } from './lib/chess'
import { explainMove, stockfishChessReply } from './lib/chat'
import type { ChatStatus, ImportFormat, Mode, PromotionPiece } from './types/chess'

type DragPointer = { pointerId: number; from: Square; startX: number; startY: number; moved: boolean }
type PointerPosition = { x: number; y: number }

const PIECE_GLYPHS: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}
const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  text: "Hey, I'm Stockbot. Ask me anything, or ask about this position. I can explore moves with Stockfish while we talk.",
}

function App() {
  const chess = useChessGame()
  const { game, gameRef, fen, history, orientation, selected, legalTargets, lastMove, pendingPromotion } = chess
  const [mode, setMode] = useState<Mode>('play')
  const [humanColor, setHumanColor] = useState<'w' | 'b'>('w')
  const modeRef = useRef(mode)
  const humanColorRef = useRef(humanColor)
  const resignedRef = useRef(false)
  const stockfishRef = useRef<ReturnType<typeof useStockfish> | null>(null)
  const dragPointerRef = useRef<DragPointer | null>(null)
  const dragTargetRef = useRef<Square | null>(null)
  const suppressClickRef = useRef(false)
  const chatInFlightRef = useRef(false)
  const chatAbortRef = useRef<AbortController | null>(null)
  const modelReadyRef = useRef(false)
  const chatRequestId = useRef(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [draggingSquare, setDraggingSquare] = useState<Square | null>(null)
  const [dragTarget, setDragTarget] = useState<Square | null>(null)
  const [dragPosition, setDragPosition] = useState<PointerPosition | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [draft, setDraft] = useState('')
  const [chatStatus, setChatStatus] = useState<ChatStatus>('checking')
  const [chatThinking, setChatThinking] = useState(false)
  const [resigned, setResigned] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importFormat, setImportFormat] = useState<ImportFormat>('fen')
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')

  modeRef.current = mode
  humanColorRef.current = humanColor
  resignedRef.current = resigned

  const stockfish = useStockfish({
    getCurrentFen: () => gameRef.current.fen(),
    onBestMove: (position, uciMove) => {
      if (position !== gameRef.current.fen() || modeRef.current !== 'play' || gameRef.current.turn() === humanColorRef.current || resignedRef.current) return
      const promotion = uciMove[4] as PromotionPiece | undefined
      if (!chess.playEngineMove(uciMove.slice(0, 2) as Square, uciMove.slice(2, 4) as Square, promotion)) return
      if (!gameRef.current.isGameOver()) {
        window.setTimeout(() => {
          const currentGame = gameRef.current
          stockfishRef.current?.analyze(currentGame.fen(), chess.enginePositionCommand())
        }, 0)
      }
    },
  })
  stockfishRef.current = stockfish
  const { ready: engineReady, thinking, threads: engineThreads, line: engineLine } = stockfish

  const analyze = (position = gameRef.current.fen(), depth = 0) => {
    const currentGame = gameRef.current
    const command = currentGame.fen() === position ? chess.enginePositionCommand() : `position fen ${position}`
    stockfish.analyze(position, command, modeRef.current === 'analysis' ? 0 : depth || 22)
  }
  const askEngineToMove = (position = gameRef.current.fen()) => stockfish.playBestMove(position, chess.enginePositionCommand())
  const continueAfterMove = () => {
    const currentGame = gameRef.current
    if (currentGame.isGameOver()) stockfish.stop()
    else if (modeRef.current === 'play' && currentGame.turn() !== humanColorRef.current) askEngineToMove(currentGame.fen())
    else analyze(currentGame.fen())
  }

  useEffect(() => {
    if (engineReady) analyze(gameRef.current.fen(), 18)
  }, [engineReady])

  useEffect(() => {
    let cancelled = false
    let retryTimer: number | undefined
    const checkChatModel = async () => {
      if (!chatInFlightRef.current) setChatStatus('checking')
      try {
        const response = await fetch('/api/ollama/api/tags', { signal: AbortSignal.timeout(3000) })
        if (!response.ok) throw new Error('Local model service unavailable')
        const result = await response.json() as { models?: { name: string }[] }
        const available = result.models?.some((model) => model.name === 'qwen3:1.7b' || model.name.startsWith('qwen3:1.7b-')) ?? false
        modelReadyRef.current = available
        if (!cancelled) {
          if (!chatInFlightRef.current) setChatStatus(available ? 'ready' : 'offline')
          if (!available) retryTimer = window.setTimeout(() => { void checkChatModel() }, 4000)
        }
      } catch {
        modelReadyRef.current = false
        if (!cancelled) {
          if (!chatInFlightRef.current) setChatStatus('offline')
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

  const movePiece = (from: Square, to: Square) => {
    const currentGame = gameRef.current
    if (from === to || resignedRef.current || currentGame.isGameOver() || (modeRef.current === 'play' && currentGame.turn() !== humanColorRef.current)) return false
    const result = chess.attemptMove(from, to)
    if (result === 'invalid') return false
    if (result === 'moved') continueAfterMove()
    return true
  }

  useEffect(() => {
    const findSquare = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('.square[data-square]')?.dataset.square as Square | undefined
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const square = findSquare(event.clientX, event.clientY)
      const piece = square && gameRef.current.get(square)
      if (!square || !piece || resignedRef.current || gameRef.current.isGameOver()) return
      if (modeRef.current === 'play' && (piece.color !== humanColorRef.current || gameRef.current.turn() !== humanColorRef.current)) return
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
      if (!target || !movePiece(drag.from, target)) chess.select(drag.from)
      setDraggingSquare(null)
      setDragTarget(null)
      setDragPosition(null)
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 50)
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
    stockfish.stop()
    chess.newGame(color)
    setHumanColor(color)
    setResigned(false)
    setMessages([INITIAL_MESSAGE])
    if (modeRef.current === 'play' && color === 'b') window.setTimeout(() => askEngineToMove(gameRef.current.fen()), 120)
    else analyze(gameRef.current.fen())
  }

  const changeMode = (nextMode: Mode) => {
    stockfish.stop()
    modeRef.current = nextMode
    setMode(nextMode)
    setResigned(false)
    if (nextMode === 'analysis') {
      setMessages((current) => [...current, { role: 'assistant', text: 'Analysis mode on. Explore any legal continuation; I’ll keep evaluating the position as it changes.' }])
      analyze(gameRef.current.fen())
    } else {
      startNewGame(humanColor)
      setMessages((current) => [...current, { role: 'assistant', text: `Fresh game. You’re ${humanColor === 'w' ? 'White' : 'Black'}; I’ll play the other side.` }])
    }
  }

  const undoMove = () => {
    stockfish.stop()
    if (chess.undo(mode, humanColor)) analyze(gameRef.current.fen())
  }
  const redoMove = () => {
    stockfish.stop()
    if (chess.redo(mode, humanColor)) {
      if (mode === 'play' && gameRef.current.turn() !== humanColor) askEngineToMove(gameRef.current.fen())
      else analyze(gameRef.current.fen())
    }
  }
  const navigateHistory = (ply: number) => {
    stockfish.stop()
    modeRef.current = 'analysis'
    setMode('analysis')
    setResigned(false)
    if (chess.navigateTo(ply)) analyze(gameRef.current.fen())
  }
  const selectPromotion = (piece: PromotionPiece) => {
    if (chess.choosePromotion(piece)) continueAfterMove()
  }

  const sendMessage = async (text = draft) => {
    const trimmed = text.trim()
    if (!trimmed || chatInFlightRef.current) return
    const requestId = ++chatRequestId.current
    const currentGame = gameRef.current
    const context = createEngineContext(currentGame, mode, engineLine)
    const isChessQuestion = /\b(chess|fen|pgn|stockfish|checkmate|stalemate|castling|castle|en passant|promotion|pawn|king|queen|rook|bishop|knight|opening|variation|tactic|blunder|board|position|evaluation|eval|winning|best move|next move|last move|my move|whose turn|your turn|my turn|legal move|who(?:'s| is) better)\b/i.test(trimmed)
    setMessages((current) => [...current, { role: 'user', text: trimmed }])
    setDraft('')
    inputRef.current?.focus()
    if (isChessQuestion) {
      setMessages((current) => [...current, { role: 'assistant', text: stockfishChessReply(trimmed, currentGame, context, mode, humanColor) }])
      return
    }

    chatInFlightRef.current = true
    setChatThinking(true)
    setChatStatus('thinking')
    const controller = new AbortController()
    chatAbortRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 120_000)
    const requestMessages = [...messages.slice(-12).map((message) => ({ role: message.role, content: message.text })), { role: 'user', content: trimmed }]
    const systemPrompt = `You are Stockbot, a friendly and thoughtful assistant. The user may discuss any subject, not just chess. Answer unrelated questions naturally without steering them back to chess. For chess questions about the current position, prioritize the supplied Stockfish result and never invent an evaluation, best move, or variation. State clearly when engine data is unavailable.\n\n${engineContextPrompt(context, currentGame.history())}`
    try {
      const response = await fetch('/api/ollama/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ model: 'qwen3:1.7b', stream: false, think: false, options: { temperature: 0.7, num_ctx: 4096, num_predict: 350 }, messages: [{ role: 'system', content: systemPrompt }, ...requestMessages] }),
      })
      if (!response.ok) throw new Error(`Local model request failed (${response.status})`)
      const result = await response.json() as { message?: { content?: string } }
      const reply = (result.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      if (!reply) throw new Error('Local model returned an empty response')
      if (requestId === chatRequestId.current) {
        modelReadyRef.current = true
        setChatStatus('ready')
        setMessages((current) => [...current, { role: 'assistant', text: reply }])
      }
    } catch (error) {
      if (requestId === chatRequestId.current) {
        modelReadyRef.current = false
        setChatStatus('offline')
        const fallback = isChessQuestion
          ? explainMove(trimmed, currentGame, context, mode)
          : 'This question is unrelated to the board, so I will not guess an answer from chess data. Start Ollama and send it again for a general response.'
        const reason = controller.signal.aborted ? 'The local chat request timed out.' : error instanceof Error && error.message ? `The local chat request failed: ${error.message}.` : 'I can’t reach the local chat model right now. Please make sure Ollama is running.'
        setMessages((current) => [...current, { role: 'assistant', text: `${reason} ${fallback}` }])
      }
    } finally {
      window.clearTimeout(timeout)
      if (requestId === chatRequestId.current) {
        chatAbortRef.current = null
        chatInFlightRef.current = false
        setChatThinking(false)
      }
    }
  }

  const resetConversation = () => {
    chatRequestId.current += 1
    chatAbortRef.current?.abort()
    chatAbortRef.current = null
    chatInFlightRef.current = false
    setChatThinking(false)
    setChatStatus(modelReadyRef.current ? 'ready' : 'offline')
    setMessages([INITIAL_MESSAGE])
  }

  const importPosition = () => {
    const source = importText.trim()
    const result = chess.importGame(importFormat, source)
    if (!result.ok) {
      setImportError(result.error)
      return
    }
    stockfish.stop()
    modeRef.current = 'analysis'
    setMode('analysis')
    setResigned(false)
    chess.setOrientation(humanColor)
    setImportError('')
    setImportOpen(false)
    setMessages((current) => [...current, { role: 'assistant', text: `${importFormat.toUpperCase()} loaded. We’re now analyzing the imported position.` }])
    analyze(gameRef.current.fen())
  }

  const resign = () => {
    stockfish.stop()
    setResigned(true)
    setMessages((current) => [...current, { role: 'assistant', text: 'Game resigned. Stockbot wins this one. Ready for a rematch whenever you are.' }])
  }

  const material = materialBalance(game)

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Stockbot home"><span className="brand-mark"><span>♞</span></span><span className="brand-name">stock<span>bot</span></span></a>
        <div className="topbar-center"><span className="eyebrow">YOUR CHESS COMPANION</span><span className="topbar-divider" /><span className="topbar-note">Think out loud.</span></div>
        <div className="engine-status"><span className={`status-dot ${engineReady ? 'ready' : ''}`} /><span>{engineReady ? `FULL ENGINE · ${engineThreads} THREADS` : 'LOADING FULL ENGINE'}</span><span className="status-version">SF 19</span></div>
      </header>

      <div className="workspace">
        <section className="play-area">
          <div className="section-heading">
            <div><div className="crumb"><span>STOCKBOT</span><span>/</span><span>{mode === 'play' ? 'LIVE GAME' : 'ANALYSIS'}</span></div><h1>{mode === 'play' ? 'Your next move.' : 'The position, unpacked.'}</h1></div>
            <div className="heading-controls">
              {mode === 'play' && <label className="side-choice"><span>PLAY AS</span><select value={humanColor} onChange={(event) => startNewGame(event.target.value as 'w' | 'b')} aria-label="Choose your side"><option value="w">White</option><option value="b">Black</option></select></label>}
              <button className="import-trigger" onClick={() => { setImportError(''); setImportText(''); setImportOpen(true) }}><FileUp size={15} /> Import</button>
              <div className="mode-switch" aria-label="Game mode"><button className={mode === 'play' ? 'active' : ''} onClick={() => changeMode('play')}><Swords size={15} /> Play</button><button className={mode === 'analysis' ? 'active' : ''} onClick={() => changeMode('analysis')}><Gauge size={15} /> Analysis</button></div>
            </div>
          </div>

          <div className="board-layout">
            <div className="board-column">
              <ChessBoard game={game} orientation={orientation} mode={mode} humanColor={humanColor} selected={selected} legalTargets={legalTargets} lastMove={lastMove} draggingSquare={draggingSquare} dragTarget={dragTarget} resigned={resigned} engineLine={engineLine} onSquare={handleSquare} onNewGame={() => startNewGame()} />
              <div className="board-toolbar">
                <div className="turn-status"><span className={`turn-pip ${game.turn() === 'w' ? 'white-pip' : 'black-pip'}`} />{resigned ? 'Game resigned. Start a new game.' : positionLabel(game)}</div>
                <div className="board-actions">
                  <button className="icon-button" aria-label="Undo move" title="Undo move" onClick={undoMove} disabled={!chess.canUndo}><ArrowLeft size={17} /></button>
                  <button className="icon-button" aria-label="Redo move" title="Redo move" onClick={redoMove} disabled={!chess.canRedo}><ArrowRight size={17} /></button>
                  <span className="action-divider" />
                  <button className="icon-button" aria-label="Flip board" title="Flip board" onClick={() => chess.setOrientation((current) => current === 'w' ? 'b' : 'w')}><ArrowDownUp size={16} /></button>
                  <button className="icon-button" aria-label="New game" title="New game" onClick={() => startNewGame()}><RotateCcw size={16} /></button>
                  {mode === 'play' && <button className="icon-button resign-button" aria-label="Resign" title="Resign" onClick={resign}><Flag size={15} /></button>}
                </div>
              </div>
            </div>
            <PositionPanel game={game} fen={fen} history={history} cursor={chess.cursor} material={material} engineLine={engineLine} engineReady={engineReady} thinking={thinking} onNavigatePly={navigateHistory} onAsk={() => sendMessage('What is the best move here?')} />
          </div>
          <div className="below-board-note"><span className="note-line" />{mode === 'play' ? 'Play a move. We’ll figure out the rest together.' : 'Explore a line. The engine will follow along.'}</div>
        </section>
        <ChatPanel messages={messages} draft={draft} status={chatStatus} thinking={chatThinking} moveCount={chess.cursor} inputRef={inputRef} onDraftChange={setDraft} onSend={sendMessage} onReset={resetConversation} />
      </div>

      {draggingSquare && dragPosition && (() => {
        const piece = game.get(draggingSquare)
        return piece ? <span className={`piece piece-drag-preview ${piece.color === 'w' ? 'piece-white' : 'piece-black'}`} data-glyph={PIECE_GLYPHS[`${piece.color}${piece.type}`]} style={{ left: dragPosition.x, top: dragPosition.y }} aria-hidden="true">{PIECE_GLYPHS[`${piece.color}${piece.type}`]}</span> : null
      })()}
      {importOpen && <ImportModal format={importFormat} text={importText} error={importError} onFormatChange={(format) => { setImportFormat(format); setImportError('') }} onTextChange={(text) => { setImportText(text); setImportError('') }} onSubmit={importPosition} onClose={() => setImportOpen(false)} />}
      {pendingPromotion && <PromotionPicker color={pendingPromotion.color} onChoose={selectPromotion} onCancel={chess.cancelPromotion} />}
      <footer className="page-footer"><span>STOCKBOT <span className="footer-dot">·</span> STOCKFISH 19 <span className="footer-dot">·</span> <a href={`${import.meta.env.BASE_URL}engine/COPYING.txt`} target="_blank" rel="noreferrer">GPLv3</a></span><span>Every position has a story.</span><span><Crown size={12} /> Play thoughtfully</span></footer>
    </main>
  )
}

export default App
