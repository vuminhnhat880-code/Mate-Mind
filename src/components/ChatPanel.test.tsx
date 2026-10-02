import { createRef } from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../hooks/useChat'
import { ChatPanel } from './ChatPanel'

describe('ChatPanel scrolling', () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScrollIntoView })
    vi.unstubAllGlobals()
  })

  it('avoids smooth auto-scroll when reduced motion is preferred', () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const messages: ChatMessage[] = [{ role: 'assistant', text: 'Welcome.' }]

    render(
      <ChatPanel
        messages={messages}
        draft=""
        status="ready"
        thinking={false}
        moveCount={0}
        inputRef={createRef<HTMLInputElement>()}
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'nearest' })
  })
})
