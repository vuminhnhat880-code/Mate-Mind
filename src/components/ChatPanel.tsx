import { useEffect, useRef, type RefObject } from 'react'
import { MessageCircle, Send, Sparkles, SquarePen } from 'lucide-react'
import type { ChatMessage } from '../hooks/useChat'
import type { ChatStatus } from '../types/chess'

type ChatPanelProps = {
  messages: ChatMessage[]
  draft: string
  status: ChatStatus
  thinking: boolean
  moveCount: number
  inputRef: RefObject<HTMLInputElement | null>
  onDraftChange: (draft: string) => void
  onSend: (text?: string) => void
  onReset: () => void
}

export function ChatPanel({ messages, draft, status, thinking, moveCount, inputRef, onDraftChange, onSend, onReset }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  const statusLabel = status === 'ready' ? 'Qwen 3 · on device' : status === 'checking' ? 'Checking Ollama' : status === 'thinking' ? 'Thinking…' : 'Ollama offline'
  return (
    <aside className="chat-panel">
      <div className="chat-header">
        <div className="chat-title"><div className="chat-avatar"><MessageCircle size={19} /></div><div><h2>Chat anything</h2><span><span className={`chat-online ${status === 'ready' ? '' : status === 'thinking' ? 'thinking' : 'offline'}`} />{statusLabel}</span></div></div>
        <button className="icon-button chat-menu" title="New conversation" aria-label="New conversation" onClick={onReset}><SquarePen size={16} /></button>
      </div>
      <div className="conversation-context"><span className="context-pin" /><span>FOLLOWING THIS BOARD</span><span className="context-divider" /><span>{moveCount ? `${Math.ceil(moveCount / 2)} MOVES` : 'START POSITION'}</span></div>
      <div className="chat-messages" aria-live="polite">
        <div className="date-marker"><span />TODAY<span /></div>
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
            {message.role === 'assistant' && <div className="message-avatar">♞</div>}
            <div className="message-body">
              {message.role === 'assistant' && <span className="message-name">STOCKBOT <span>·</span> {index === 0 ? 'JUST NOW' : 'POSITION-AWARE'}</span>}
              <div className="message-bubble">{message.text}</div>
            </div>
          </div>
        ))}
        {thinking && <div className="thinking-indicator"><span /><span /><span /><small>Stockbot is thinking</small></div>}
        <div ref={bottomRef} />
      </div>
      <div className="quick-prompts"><span className="prompt-label">TRY ASKING</span><div className="prompt-list">
        <button disabled={thinking} onClick={() => onSend('What is the best move here?')}>Best move?</button>
        <button disabled={thinking} onClick={() => onSend('Who is winning?')}>Who’s better?</button>
        <button disabled={thinking} onClick={() => onSend('What opening is this?')}>Name this opening</button>
      </div></div>
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); onSend() }}>
        <input ref={inputRef} value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Ask anything about the game…" aria-label="Message Stockbot" />
        <button type="submit" disabled={!draft.trim() || thinking} aria-label="Send message"><Send size={17} /></button>
        <div className="composer-footer"><span><Sparkles size={12} /> LOCAL MODEL · STOCKFISH CONTEXT</span><span>ENTER ↵</span></div>
      </form>
      <div className="chat-footnote"><span>♞</span>Built for the love of the game.</div>
    </aside>
  )
}
