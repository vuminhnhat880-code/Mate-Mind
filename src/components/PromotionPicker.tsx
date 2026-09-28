import type { KeyboardEvent } from 'react'
import type { PromotionPiece } from '../types/chess'

type PromotionPickerProps = {
  color: 'w' | 'b'
  onChoose: (piece: PromotionPiece) => void
  onCancel: () => void
}

const choices: { piece: PromotionPiece; whiteGlyph: string; blackGlyph: string; vi: string; en: string }[] = [
  { piece: 'q', whiteGlyph: '♕', blackGlyph: '♛', vi: 'Nữ hoàng', en: 'Queen' },
  { piece: 'r', whiteGlyph: '♖', blackGlyph: '♜', vi: 'Xe', en: 'Rook' },
  { piece: 'b', whiteGlyph: '♗', blackGlyph: '♝', vi: 'Tượng', en: 'Bishop' },
  { piece: 'n', whiteGlyph: '♘', blackGlyph: '♞', vi: 'Mã', en: 'Knight' },
]

export function PromotionPicker({ color, onChoose, onCancel }: PromotionPickerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') onCancel()
  }

  return (
    <div className="modal-backdrop promotion-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section className="promotion-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-title" onKeyDown={handleKeyDown}>
        <div className="promotion-heading"><span>PROMOTION</span><h2 id="promotion-title">Choose a piece</h2><p>Your pawn will stay in place until you choose.</p></div>
        <div className="promotion-options">
          {choices.map(({ piece, whiteGlyph, blackGlyph, vi, en }, index) => <button key={piece} autoFocus={index === 0} className="promotion-option" onClick={() => onChoose(piece)} aria-label={`${vi} (${en})`}>
            <span className={`promotion-glyph ${color === 'b' ? 'black' : ''}`}>{color === 'b' ? blackGlyph : whiteGlyph}</span>
            <span>{vi}</span><small>{en}</small>
          </button>)}
        </div>
        <button className="promotion-cancel" onClick={onCancel}>Cancel promotion</button>
      </section>
    </div>
  )
}
