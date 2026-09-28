import { useState } from 'react'
import { ArrowRight, ChevronDown, CircleHelp, Sparkles, SquarePen, Zap } from 'lucide-react'
import type { Chess } from 'chess.js'
import { detectOpening } from '../lib/openings'
import type { EngineLine } from '../types/chess'

type PositionPanelProps = {
  game: Chess
  fen: string
  history: string[]
  cursor: number
  material: number
  engineLine: EngineLine
  engineReady: boolean
  thinking: boolean
  onNavigatePly: (ply: number) => void
  onAsk: () => void
}

export function PositionPanel({ game, fen, history, cursor, material, engineLine, engineReady, thinking, onNavigatePly, onAsk }: PositionPanelProps) {
  const [activeTab, setActiveTab] = useState<'moves' | 'details'>('moves')
  const evaluation = engineLine.mate !== null ? `M${engineLine.mate}` : engineLine.score === null ? '—' : `${engineLine.score >= 0 ? '+' : ''}${(engineLine.score / 100).toFixed(2)}`
  const movePairs: [string, string?][] = []
  for (let index = 0; index < history.length; index += 2) movePairs.push([history[index], history[index + 1]])

  return (
    <aside className="position-panel">
      <div className="panel-tabs">
        <button className={activeTab === 'moves' ? 'selected-tab' : ''} onClick={() => setActiveTab('moves')}><SquarePen size={14} /> Moves</button>
        <button className={activeTab === 'details' ? 'selected-tab' : ''} onClick={() => setActiveTab('details')}><CircleHelp size={14} /> Position</button>
      </div>
      {activeTab === 'moves' ? <>
        <div className="moves-heading"><span>MOVE</span><span>WHITE</span><span>BLACK</span></div>
        <div className="move-list">
          {movePairs.length ? movePairs.map(([white, black], index) => (
            <div className={`move-row ${cursor > index * 2 && cursor <= index * 2 + 2 ? 'latest-move' : ''}`} key={`${white ?? 'x'}-${black ?? 'x'}-${index}`}>
              <span className="move-number">{index + 1}.</span>
              <span className="move-cell"><button type="button" className={`move-jump ${cursor === index * 2 + 1 ? 'current' : ''}`} aria-current={cursor === index * 2 + 1 ? 'step' : undefined} onClick={() => onNavigatePly(index * 2 + 1)}>{white}</button></span>
              <span className="move-cell">{black ? <button type="button" className={`move-jump ${cursor === index * 2 + 2 ? 'current' : ''}`} aria-current={cursor === index * 2 + 2 ? 'step' : undefined} onClick={() => onNavigatePly(index * 2 + 2)}>{black}</button> : null}</span>
            </div>
          )) : <div className="empty-moves"><span className="empty-knight">♘</span><span>The board is yours.</span><span>Make a move to begin.</span></div>}
        </div>
        <div className="opening-note"><span className="opening-icon">✳</span><div><span>OPENING</span><strong>{detectOpening(history)}</strong></div><ChevronDown size={15} /></div>
      </> : <div className="position-details">
        <div className="detail-stat"><span>POSITION</span><strong>{game.isCheckmate() ? 'Checkmate' : game.isDraw() ? 'Draw' : game.isCheck() ? 'Check' : 'In play'}</strong></div>
        <div className="detail-stat"><span>TO MOVE</span><strong>{game.turn() === 'w' ? 'White' : 'Black'}</strong></div>
        <div className="detail-stat"><span>MATERIAL</span><strong>{material === 0 ? 'Equal' : `${material > 0 ? 'White' : 'Black'} +${Math.abs(material)}`}</strong></div>
        <div className="detail-stat"><span>FEN</span><code>{fen}</code></div>
        <button className="copy-fen" onClick={() => navigator.clipboard?.writeText(fen)}>Copy FEN</button>
      </div>}
      <div className="engine-card">
        <div className="engine-card-top"><div className="engine-card-icon"><Zap size={15} /></div><span>ENGINE INSIGHT</span><span className="engine-depth">{engineLine.depth ? `D${engineLine.depth}` : '—'}</span></div>
        <div className="engine-evaluation"><strong>{evaluation}</strong><span>{thinking ? 'Thinking through it…' : engineLine.score === null && engineLine.mate === null ? 'No completed evaluation' : 'Position evaluation'}</span></div>
        <div className="best-move"><span>BEST MOVE</span><strong>{engineLine.bestMove || (engineReady ? 'Calculating' : 'Starting engine')}</strong><span className="best-line">{engineLine.line.slice(1).join(' · ') || '—'}</span></div>
      </div>
      <button className="analyze-link" onClick={onAsk}><Sparkles size={15} /> Ask about this position <ArrowRight size={15} /></button>
    </aside>
  )
}
