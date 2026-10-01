import { fireEvent, render } from '@testing-library/react'
import { Chess } from 'chess.js'
import { describe, expect, it, vi } from 'vitest'
import { ChessBoard } from './ChessBoard'
import { EMPTY_ENGINE_LINE } from '../types/chess'

describe('ChessBoard keyboard interaction', () => {
  it('moves focus across squares with arrow keys without changing chess state', () => {
    const game = new Chess()
    const { getByLabelText } = render(
      <ChessBoard
        game={game}
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
})
