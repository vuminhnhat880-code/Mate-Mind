import { fireEvent, render } from '@testing-library/react'
import { Chess } from 'chess.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PositionPanel } from './PositionPanel'
import { DEFAULT_ENGINE_SETTINGS } from '../lib/stockfish'
import { EMPTY_ENGINE_LINE } from '../types/chess'
import type { ReviewedMove } from '../types/chess'

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

afterEach(() => {
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

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

  it('detects the opening only from moves up to the selected position', () => {
    const history = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5']
    const { getByText } = render(
      <PositionPanel
        game={new Chess()}
        mode="analysis"
        fen={new Chess().fen()}
        history={history}
        cursor={2}
        material={0}
        engineLine={EMPTY_ENGINE_LINE}
        engineReady
        thinking={false}
        multithreaded
        candidates={[]}
        settings={DEFAULT_ENGINE_SETTINGS}
        evaluationHistory={[]}
        reviewedMoves={[]}
        reviewSummary={null}
        reviewProgress={null}
        reviewError={null}
        onNavigatePly={vi.fn()}
        onAsk={vi.fn()}
        onSettingsChange={vi.fn()}
        onStopAnalysis={vi.fn()}
        onStartReview={vi.fn()}
        onCancelReview={vi.fn()}
      />,
    )

    expect(getByText("King's Pawn Opening")).toBeTruthy()
  })

  it('explains when the browser cannot copy the FEN', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { getByRole, findByRole } = render(
      <PositionPanel
        game={new Chess()}
        mode="analysis"
        fen={new Chess().fen()}
        history={[]}
        cursor={0}
        material={0}
        engineLine={EMPTY_ENGINE_LINE}
        engineReady
        thinking={false}
        multithreaded
        candidates={[]}
        settings={DEFAULT_ENGINE_SETTINGS}
        evaluationHistory={[]}
        reviewedMoves={[]}
        reviewSummary={null}
        reviewProgress={null}
        reviewError={null}
        onNavigatePly={vi.fn()}
        onAsk={vi.fn()}
        onSettingsChange={vi.fn()}
        onStopAnalysis={vi.fn()}
        onStartReview={vi.fn()}
        onCancelReview={vi.fn()}
      />,
    )
    fireEvent.click(getByRole('button', { name: 'Position' }))
    fireEvent.click(getByRole('button', { name: 'Copy FEN' }))

    expect((await findByRole('alert')).textContent).toContain('Could not copy FEN')
    expect(writeText).toHaveBeenCalledOnce()
  })
})
