import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { detectChatIntent, explainMove, stockfishChessReply } from './chat'
import { createEngineContext } from './chess'
import { EMPTY_ENGINE_LINE } from '../types/chess'

describe('detectChatIntent', () => {
  it.each([
    ['Why is this move bad?', 'move-explanation'],
    ['What should I play?', 'best-move'],
    ['Who is better?', 'evaluation'],
    ['Can White win this position?', 'evaluation'],
    ['What is the best move?', 'best-move'],
    ['Explain this position', 'move-explanation'],
    ['Why did Stockfish choose this?', 'move-explanation'],
    ['Is there a brilliant move?', 'move-explanation'],
    ['Tell me about space exploration', 'general'],
  ] as const)('classifies "%s"', (question, intent) => {
    expect(detectChatIntent(question)).toBe(intent)
  })

  it('does not fabricate an engine move or evaluation when no result exists', () => {
    const game = new Chess()
    const context = createEngineContext(game, 'analysis', EMPTY_ENGINE_LINE)
    const answer = stockfishChessReply('What should I play?', game, context, 'analysis', 'w')
    expect(answer).toContain('still analysing this exact position')
    expect(answer).not.toMatch(/[+-]\d+\.\d\d/)
  })

  it('routes rule questions to deterministic chess explanations', () => {
    const game = new Chess()
    const context = createEngineContext(game, 'analysis', EMPTY_ENGINE_LINE)
    expect(explainMove('How does castling work?', game, context, 'analysis')).toContain('Castling moves your king')
    expect(stockfishChessReply('What is the best move?', game, context, 'analysis', 'w')).toContain('Stockfish is still analysing')
  })

  it('answers brilliant-move questions without routing them to Ollama or inventing a label', () => {
    const game = new Chess()
    const context = createEngineContext(game, 'analysis', EMPTY_ENGINE_LINE)
    const answer = stockfishChessReply('Is there a brilliant move?', game, context, 'analysis', 'w')
    expect(answer).toContain('Run Game Review')
    expect(answer).toContain('narrow sacrifice-and-compensation heuristic')
    expect(answer).toContain('does not have a completed evaluation')
  })
})
