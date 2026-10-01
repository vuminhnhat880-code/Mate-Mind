import { useEffect, useRef } from 'react'
import { ArrowRight, X } from 'lucide-react'
import type { ImportFormat } from '../types/chess'

type ImportModalProps = {
  format: ImportFormat
  text: string
  error: string
  onFormatChange: (format: ImportFormat) => void
  onTextChange: (text: string) => void
  onSubmit: () => void
  onClose: () => void
}

export function ImportModal({ format, text, error, onFormatChange, onTextChange, onSubmit, onClose }: ImportModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, [href], input, select') ?? [])
    focusable()[0]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
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
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="import-dialog-header"><div><span className="crumb">BOARD TOOLS / IMPORT</span><h2 id="import-title">Bring a position in.</h2></div><button className="icon-button" aria-label="Close import" onClick={onClose}><X size={17} /></button></div>
        <p className="import-description">Paste a FEN position or PGN game. Imported games open in analysis mode.</p>
        <div className="import-format-switch" role="tablist" aria-label="Import format">
          <button role="tab" aria-selected={format === 'fen'} className={format === 'fen' ? 'active' : ''} onClick={() => onFormatChange('fen')}>FEN position</button>
          <button role="tab" aria-selected={format === 'pgn'} className={format === 'pgn' ? 'active' : ''} onClick={() => onFormatChange('pgn')}>PGN game</button>
        </div>
        <textarea className="import-textarea" value={text} onChange={(event) => onTextChange(event.target.value)} placeholder={format === 'fen' ? 'Paste FEN, e.g. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : '[Event "Casual Game"]\n\n1. e4 e5 2. Nf3 Nc6'} aria-label={`Paste ${format.toUpperCase()}`} />
        {error && <p className="import-error" role="alert">{error}</p>}
        <div className="import-dialog-footer"><span>{format === 'fen' ? 'Loads one board position.' : 'Loads the game, move list, and PGN headers.'}</span><button className="import-submit" onClick={onSubmit}>Load {format.toUpperCase()} <ArrowRight size={15} /></button></div>
      </section>
    </div>
  )
}
