import { fireEvent, render } from '@testing-library/react'
import { Chess } from 'chess.js'
import { describe, expect, it, vi } from 'vitest'
import { PositionPanel } from './PositionPanel'
import { DEFAULT_ENGINE_SETTINGS } from '../lib/stockfish'
import { EMPTY_ENGINE_LINE } from '../types/chess'
import type { ReviewedMove } from '../types/chess'

describe('PositionPanel game review', () => {
  it('shows every reviewed move with its classification and navigates to that move', () => {
    const onNavigatePly = vi.fn()
    const reviewedMoves: ReviewedMove[] = [
      { ply: 1, san: 'e4', classification: 'Best', centipawnLoss: 0, before: 20, after: 25 },
      { ply: 2, san: 'c5', classification: 'Excellent', centipawnLoss: 20, before: 25, after: 5 },
      { ply: 3, san: 'Nf3', classification: 'Mistake', centipawnLoss: 150, before: 5, after: -145 },
    ]
    const { getByRole, getByText } = render(
      <PositionPanel
        game={new Chess()}
        mode="analysis"
        fen={new Chess().fen()}
        history={['e4', 'c5', 'Nf3']}
        cursor={3}
        material={0}
        engineLine={EMPTY_ENGINE_LINE}
        engineReady
        thinking={false}
        multithreaded
        candidates={[]}
        settings={DEFAULT_ENGINE_SETTINGS}
        evaluationHistory={[]}
        reviewedMoves={reviewedMoves}
        reviewSummary='+0.25'
        reviewProgress={null}
        reviewError={null}
        onNavigatePly={onNavigatePly}
        onAsk={vi.fn()}
        onSettingsChange={vi.fn()}
        onStopAnalysis={vi.fn()}
        onStartReview={vi.fn()}
        onCancelReview={vi.fn()}
      />,
    )

    expect(getByText('Move-by-move review')).toBeTruthy()
    expect(getByText('2 total moves')).toBeTruthy()
    const best = getByRole('button', { name: '1. e4: Best, 0 centipawns lost' })
    expect(best.textContent).toContain('+0.20 → +0.25')
    expect(getByRole('button', { name: '1... c5: Excellent, 20 centipawns lost' })).toBeTruthy()
    fireEvent.click(getByRole('button', { name: '2. Nf3: Mistake, 150 centipawns lost' }))
    expect(onNavigatePly).toHaveBeenCalledWith(3)
  })
})
