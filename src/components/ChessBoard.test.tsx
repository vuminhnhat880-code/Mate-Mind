import { fireEvent, render } from '@testing-library/react'
import { Chess } from 'chess.js'
import { describe, expect, it, vi } from 'vitest'
import { ChessBoard } from './ChessBoard'
import { EMPTY_ENGINE_LINE } from '../types/chess'

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

describe('ChessBoard keyboard interaction', () => {
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
})
