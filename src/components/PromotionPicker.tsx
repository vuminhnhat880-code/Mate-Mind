import { useEffect, useRef } from 'react'
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
  const dialogRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])
    focusable()[0]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop promotion-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section ref={dialogRef} className="promotion-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
        <div className="promotion-heading"><span>PROMOTION</span><h2 id="promotion-title">Choose a piece</h2><p>Your pawn will stay in place until you choose.</p></div>
        <div className="promotion-options">
          {choices.map(({ piece, whiteGlyph, blackGlyph, vi, en }, index) => <button key={piece} className="promotion-option" onClick={() => onChoose(piece)} aria-label={`${vi} (${en})`} autoFocus={index === 0}>
            <span className={`promotion-glyph ${color === 'b' ? 'black' : ''}`}>{color === 'b' ? blackGlyph : whiteGlyph}</span>
            <span>{vi}</span><small>{en}</small>
          </button>)}
        </div>
        <button className="promotion-cancel" onClick={onCancel}>Cancel promotion</button>
      </section>
    </div>
  )
}
