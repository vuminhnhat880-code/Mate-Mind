export type OpeningRecord = {
  eco?: string
  name: string
  moves: string[]
}

export const OPENINGS: OpeningRecord[] = [
  { eco: 'C20', name: "King's Pawn Game", moves: ['e4'] },
  { eco: 'C40', name: 'King’s Knight Opening', moves: ['e4', 'e5', 'Nf3'] },
  { eco: 'C50', name: 'Italian Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C54', name: 'Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
  { eco: 'C60', name: 'Ruy Lopez', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C65', name: 'Berlin Defence', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'B20', name: 'Sicilian Defence', moves: ['e4', 'c5'] },
  { eco: 'B50', name: 'Sicilian: Modern Variations', moves: ['e4', 'c5', 'Nf3', 'd6'] },
  { eco: 'B33', name: 'Sicilian: Sveshnikov Variation', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'] },
  { eco: 'C00', name: 'French Defence', moves: ['e4', 'e6'] },
  { eco: 'C10', name: 'French: Classical Variation', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'] },
  { eco: 'B10', name: 'Caro-Kann Defence', moves: ['e4', 'c6'] },
  { eco: 'B12', name: 'Caro-Kann: Advance Variation', moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'C30', name: "King's Gambit", moves: ['e4', 'e5', 'f4'] },
  { eco: 'C44', name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C25', name: 'Vienna Game', moves: ['e4', 'e5', 'Nc3'] },
  { eco: 'D00', name: "Queen's Pawn Game", moves: ['d4'] },
  { eco: 'D06', name: "Queen's Gambit", moves: ['d4', 'd5', 'c4'] },
  { eco: 'D30', name: "Queen's Gambit Declined", moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D10', name: 'Slav Defence', moves: ['d4', 'd5', 'c4', 'c6'] },
  { eco: 'E20', name: 'Nimzo-Indian Defence', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E60', name: "King's Indian Defence", moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'A10', name: 'English Opening', moves: ['c4'] },
  { eco: 'A04', name: 'Réti Opening', moves: ['Nf3'] },
  { eco: 'A00', name: 'Bird Opening', moves: ['f4'] },
  { eco: 'A80', name: 'Dutch Defence', moves: ['d4', 'f5'] },
]

export function detectOpening(moves: string[]) {
  let match: OpeningRecord | undefined
  for (const opening of OPENINGS) {
    if (opening.moves.length <= (match?.moves.length ?? 0) || opening.moves.length > moves.length) continue
    if (opening.moves.every((move, index) => move === moves[index])) match = opening
  }
  if (match) return match.name
  if (moves[0]?.startsWith('e4')) return "King's Pawn Opening"
  if (moves[0]?.startsWith('d4')) return "Queen's Pawn Opening"
  if (moves[0] === 'c4') return 'English Opening'
  if (moves[0] === 'Nf3') return 'Réti Opening'
  if (moves[0] === 'f4') return 'Bird Opening'
  return 'Unclassified'
}