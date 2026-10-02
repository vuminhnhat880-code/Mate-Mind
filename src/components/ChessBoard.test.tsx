import { fireEvent, render } from '@testing-library/react'
import { Chess } from 'chess.js'
import { describe, expect, it, vi } from 'vitest'
import { ChessBoard } from './ChessBoard'
import { evaluationForPosition } from '../lib/stockfish'
import { EMPTY_ENGINE_LINE, type EngineLine, type EvaluationPoint } from '../types/chess'

function renderBoard(evaluation: { score: number | null; mate: number | null }) {
  return render(
    <ChessBoard
      game={new Chess()}
      material={0}
      orientation="w"
      mode="analysis"
      humanColor="w"
      selected={null}
      legalTargets={[]}
      lastMove={null}
      draggingSquare={null}
      dragTarget={null}
      resigned={false}
      engineLine={{ ...EMPTY_ENGINE_LINE, score: 400, fen: new Chess().fen() }}
      evaluation={evaluation}
      onSquare={vi.fn()}
      onNewGame={vi.fn()}
    />,
  )
}

function renderPositionWithHistory(fen: string, ply: number, evaluationHistory: EvaluationPoint[], engineLine: EngineLine) {
  const evaluation = evaluationForPosition(evaluationHistory, fen, ply, engineLine)
  return render(
    <ChessBoard
      game={new Chess()}
      material={0}
      orientation="w"
      mode="analysis"
      humanColor="w"
      selected={null}
      legalTargets={[]}
      lastMove={null}
      draggingSquare={null}
      dragTarget={null}
      resigned={false}
      engineLine={engineLine}
      evaluation={evaluation}
      onSquare={vi.fn()}
      onNewGame={vi.fn()}
    />,
  )
}

describe('ChessBoard', () => {
  it('moves focus across squares with arrow keys without changing chess state', () => {
    const game = new Chess()
    const { getByLabelText } = render(
      <ChessBoard
        game={game}
        material={0}
        orientation="w"
        mode="analysis"
        humanColor="w"
        selected={null}
        legalTargets={[]}
        lastMove={null}
        draggingSquare={null}
        dragTarget={null}
        resigned={false}
        engineLine={EMPTY_ENGINE_LINE}
        evaluation={{ score: null, mate: null }}
        onSquare={vi.fn()}
        onNewGame={vi.fn()}
      />,
    )
    const e2 = getByLabelText('e2 white p')
    e2.focus()
    fireEvent.keyDown(e2, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(getByLabelText('f2 white p'))
    expect(game.history()).toEqual([])
  })

  it('uses the selected evaluation for the bar label and numeric score', () => {
    const { getByLabelText, getByText } = renderBoard({ score: -250, mate: null })
    expect(getByLabelText('Evaluation advantage -2.50; bar indicates the engine advantage')).toBeTruthy()
    expect(getByText('-2.50')).toBeTruthy()
  })

  it('shows the selected mate score in the evaluation bar and accessible label', () => {
    const { getByLabelText, getByText } = renderBoard({ score: 9950, mate: 5 })
    expect(getByLabelText('Evaluation advantage M5; bar indicates the engine advantage')).toBeTruthy()
    expect(getByText('M5')).toBeTruthy()
  })

  it('connects the matching review evaluation to the board while keeping the live best-move arrow', () => {
    const fen = new Chess().fen()
    const engineLine: EngineLine = {
      ...EMPTY_ENGINE_LINE,
      score: 400,
      bestMove: 'e4',
      bestUci: 'e2e4',
      fen,
    }
    const reviewPoint: EvaluationPoint = { ply: 3, fen, score: -250, mate: null, source: 'review' }
    const { getByLabelText, getByText, getByRole, container } = renderPositionWithHistory(fen, 3, [reviewPoint], engineLine)

    expect(getByLabelText('Evaluation advantage -2.50; bar indicates the engine advantage')).toBeTruthy()
    expect(getByText('-2.50')).toBeTruthy()
    expect(getByRole('img', { name: 'Stockfish recommends e4' })).toBeTruthy()
    expect(Number.parseFloat(container.querySelector<HTMLElement>('.eval-black')?.style.height ?? '50%')).toBeGreaterThan(50)
  })

  it('uses the matching review mate score instead of the live score', () => {
    const fen = new Chess().fen()
    const liveLine: EngineLine = { ...EMPTY_ENGINE_LINE, score: 350, fen }
    const reviewPoint: EvaluationPoint = { ply: 3, fen, score: 9970, mate: 3, source: 'review' }
    const { getByLabelText, getByText, container } = renderPositionWithHistory(fen, 3, [reviewPoint], liveLine)
    expect(getByLabelText('Evaluation advantage M3; bar indicates the engine advantage')).toBeTruthy()
    expect(getByText('M3')).toBeTruthy()
    expect(container.querySelector<HTMLElement>('.eval-black')?.style.height).toBe('0%')
  })

  it('does not reuse a review evaluation from another FEN at the same ply', () => {
    const reviewedGame = new Chess()
    reviewedGame.move('e4')
    const currentGame = new Chess()
    currentGame.move('d4')
    const liveLine: EngineLine = { ...EMPTY_ENGINE_LINE, score: 125, fen: currentGame.fen() }
    const reviewPoint: EvaluationPoint = { ply: 1, fen: reviewedGame.fen(), score: -250, mate: null, source: 'review' }
    const { getByLabelText, getByText } = renderPositionWithHistory(currentGame.fen(), 1, [reviewPoint], liveLine)
    expect(getByLabelText('Evaluation advantage +1.25; bar indicates the engine advantage')).toBeTruthy()
    expect(getByText('+1.25')).toBeTruthy()
  })

  it('omits the best-move arrow for a zero-length engine move', () => {
    const fen = new Chess().fen()
    const engineLine: EngineLine = { ...EMPTY_ENGINE_LINE, bestMove: 'e2', bestUci: 'e2e2', fen }
    const { container } = renderPositionWithHistory(fen, 0, [], engineLine)
    expect(container.querySelector('.best-move-arrow')).toBeNull()
  })
})
