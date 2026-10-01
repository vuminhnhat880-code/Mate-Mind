import { useState } from 'react'
import { ArrowRight, ChevronDown, CircleHelp, Settings2, Sparkles, SquarePen, Zap } from 'lucide-react'
import type { Chess } from 'chess.js'
import type { Mode } from '../types/chess'
import { detectOpening, matchOpening } from '../lib/openings'
import { formatEvaluation } from '../lib/stockfish'
import type { EngineCandidate, EngineLine, EngineSettings, EvaluationPoint, ReviewedMove } from '../types/chess'

type PositionPanelProps = {
  game: Chess
  mode: Mode
  fen: string
  history: string[]
  cursor: number
  material: number
  engineLine: EngineLine
  engineReady: boolean
  thinking: boolean
  candidates: EngineCandidate[]
  settings: EngineSettings
  evaluationHistory: EvaluationPoint[]
  reviewedMoves: ReviewedMove[]
  reviewSummary: string | null
  reviewProgress: { completed: number; total: number } | null
  reviewError: string | null
  onNavigatePly: (ply: number) => void
  onAsk: () => void
  onSettingsChange: (patch: Partial<EngineSettings>) => void
  onStopAnalysis: () => void
  onStartReview: () => void
  onCancelReview: () => void
}

export function PositionPanel({
  game, mode, fen, history, cursor, material, engineLine, engineReady, thinking, candidates, settings,
  evaluationHistory, reviewedMoves, reviewSummary, reviewProgress, reviewError, onNavigatePly, onAsk,
  onSettingsChange, onStopAnalysis, onStartReview, onCancelReview,
}: PositionPanelProps) {
  const [activeTab, setActiveTab] = useState<'moves' | 'details'>('moves')
  const evaluation = formatEvaluation(engineLine.score, engineLine.mate)
  const movePairs: [string, string?][] = []
  for (let index = 0; index < history.length; index += 2) movePairs.push([history[index], history[index + 1]])
  const openingMatch = matchOpening(history)
  const reviewCounts = reviewedMoves.reduce<Record<string, number>>((counts, move) => {
    counts[move.classification] = (counts[move.classification] ?? 0) + 1
    return counts
  }, {})
  const averageLoss = reviewedMoves.length
    ? reviewedMoves.reduce((total, move) => total + move.centipawnLoss, 0) / reviewedMoves.length
    : null
  const reviewAccuracy = averageLoss === null ? null : Math.round(100 * Math.exp(-averageLoss / 250))
  const chartPoints = evaluationHistory.slice(-80)
  const coordinates = chartPoints.map((point, index) => ({
    x: chartPoints.length < 2 ? 50 : index * 100 / (chartPoints.length - 1),
    y: 20 - Math.max(-1000, Math.min(1000, point.score)) / 1000 * 17,
    point,
  }))
  const chartPath = coordinates.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ')

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
        <div className="opening-note"><span className="opening-icon">✳</span><div><span>{openingMatch?.eco ? `ECO ${openingMatch.eco}` : 'OPENING'}</span><strong>{openingMatch?.name ?? detectOpening(history)}</strong></div><ChevronDown size={15} /></div>
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
        {candidates.length > 1 && <div className="candidate-lines" aria-label="Stockfish candidate moves">
          {candidates.map((candidate) => <div className="candidate-line" key={candidate.rank}>
            <span className="candidate-rank">#{candidate.rank}</span>
            <strong>{formatEvaluation(candidate.score, candidate.mate)}</strong>
            <b>{candidate.bestMove}</b>
            <span className="candidate-pv">{candidate.line.join(' · ')}</span>
            <small>D{candidate.depth}</small>
          </div>)}
        </div>}
        <details className="engine-settings">
          <summary><Settings2 size={13} /> Engine settings</summary>
          <div className="engine-settings-grid">
            <label>Depth<select value={settings.depth} onChange={(event) => onSettingsChange({ depth: Number(event.target.value) })}>{[8, 12, 16, 18, 22, 26, 30, 40].map((depth) => <option key={depth} value={depth}>{depth}</option>)}</select></label>
            <label>Move time<select value={settings.moveTime} onChange={(event) => onSettingsChange({ moveTime: Number(event.target.value) })}>{[250, 500, 1500, 3000, 7000, 15000].map((time) => <option key={time} value={time}>{time} ms</option>)}</select></label>
            <label>Threads<select value={settings.threads} onChange={(event) => onSettingsChange({ threads: Number(event.target.value) })}>{[1, 2, 4, 8, 16].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
            <label>Hash<select value={settings.hash} onChange={(event) => onSettingsChange({ hash: Number(event.target.value) })}>{[64, 128, 256, 512, 1024, 2048].map((size) => <option key={size} value={size}>{size} MB</option>)}</select></label>
            <label>Lines<select value={settings.multiPv} onChange={(event) => onSettingsChange({ multiPv: Number(event.target.value) as EngineSettings['multiPv'] })}>{[1, 2, 3, 5].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          </div>
          <span className="engine-settings-note">Higher values use more time and memory. Saved in this browser.</span>
        </details>
        {thinking && mode === 'analysis' && !reviewProgress && <button className="stop-analysis" onClick={onStopAnalysis}>Stop analysis</button>}
      </div>
      <section className="evaluation-graph" aria-label="Evaluation history">
        <div className="evaluation-graph-title"><strong>Evaluation history</strong><span>White advantage · ±10 pawns</span></div>
        <svg viewBox="0 0 100 40" role="group" aria-label="Evaluation by move. Select a point to navigate.">
          <rect x="0" y="0" width="100" height="20" className="graph-white-zone" />
          <rect x="0" y="20" width="100" height="20" className="graph-black-zone" />
          <line x1="0" y1="20" x2="100" y2="20" className="graph-zero-line" />
          {chartPath && <path d={chartPath} className="graph-line" />}
          {coordinates.map(({ x, y, point }) => <circle key={`${point.ply}-${point.fen}`} cx={x} cy={y} r="1.7" className="graph-point" role="button" tabIndex={0} aria-label={`Move ${point.ply}: ${formatEvaluation(point.score, point.mate)}`} onClick={() => onNavigatePly(point.ply)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNavigatePly(point.ply) } }} />)}
        </svg>
        <div className="graph-end-labels"><span>White</span><span>Equal</span><span>Black</span></div>
      </section>
      <section className="game-review">
        <div className="review-heading"><div><strong>Game review</strong><span>Engine-based estimate, not an objective rating.</span></div>
          {reviewProgress ? <button onClick={onCancelReview}>Cancel</button> : <button onClick={onStartReview} disabled={cursor === 0 || !engineReady}>Review</button>}
        </div>
        {reviewProgress && <div className="review-progress" role="status"><span>Reviewing {reviewProgress.completed} / {reviewProgress.total} positions</span><progress max={reviewProgress.total} value={reviewProgress.completed} /></div>}
        {reviewError && <p className="review-error" role="alert">{reviewError}</p>}
        {reviewSummary && <div className="review-summary">Final position: <strong>{reviewSummary}</strong></div>}
        {reviewSummary && <div className="review-stats" aria-label="Game review summary">
          <span>{cursor} total moves</span><span>{reviewedMoves.length} analyzed</span><span>{reviewAccuracy ?? 0}% estimated accuracy</span>
          <span>{reviewCounts.Brilliant ?? 0} Brilliant</span><span>{reviewCounts.Best ?? 0} Best</span><span>{reviewCounts.Excellent ?? 0} Excellent</span><span>{reviewCounts.Good ?? 0} Good</span>
          <span>{reviewCounts.Inaccuracy ?? 0} Inaccuracies</span><span>{reviewCounts.Mistake ?? 0} Mistakes</span><span>{reviewCounts.Blunder ?? 0} Blunders</span>
        </div>}
        {reviewedMoves.length > 0 && <>
          <div className="review-section-label">Notable moves &amp; critical moments</div>
          <div className="review-moves">
          {reviewedMoves.filter((move) => !['Best', 'Excellent', 'Good'].includes(move.classification)).map((move) => <button key={move.ply} onClick={() => onNavigatePly(move.ply)} className={`review-move review-${move.classification.toLowerCase()}`}>
            <span>{Math.ceil(move.ply / 2)}{move.ply % 2 ? '.' : '...'} {move.san}</span><strong>{move.classification}</strong><small>{Math.round(move.centipawnLoss)} cp lost</small>
          </button>)}
          {!reviewedMoves.some((move) => !['Best', 'Excellent', 'Good'].includes(move.classification)) && <span className="review-no-moments">No notable inaccuracies found in this review.</span>}
          </div>
          <p className="review-caveat">Accuracy and move labels are rough estimates based on engine centipawn loss, not official ratings. “Brilliant” is reserved for a narrow sacrifice-and-compensation signal.</p>
        </>}
      </section>
      <button className="analyze-link" onClick={onAsk}><Sparkles size={15} /> Ask about this position <ArrowRight size={15} /></button>
    </aside>
  )
}
