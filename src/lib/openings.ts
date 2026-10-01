export type OpeningRecord = {
  eco?: string
  name: string
  moves: string[]
}

export const OPENINGS: OpeningRecord[] = [
  { eco: 'C20', name: "King's Pawn Opening", moves: ['e4'] },
  { eco: 'C21', name: 'Center Game', moves: ['e4', 'e5', 'd4', 'exd4', 'Qxd4'] },
  { eco: 'C23', name: "Bishop's Opening", moves: ['e4', 'e5', 'Bc4'] },
  { eco: 'C24', name: "Bishop's Opening: Berlin Defence", moves: ['e4', 'e5', 'Bc4', 'Nf6'] },
  { eco: 'C30', name: "King's Gambit", moves: ['e4', 'e5', 'f4'] },
  { eco: 'C40', name: "King's Knight Opening", moves: ['e4', 'e5', 'Nf3'] },
  { eco: 'C41', name: 'Philidor Defence', moves: ['e4', 'e5', 'Nf3', 'd6'] },
  { eco: 'C42', name: 'Petrov Defence', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C45', name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'] },
  { eco: 'C46', name: 'Three Knights Opening', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3'] },
  { eco: 'C47', name: 'Four Knights Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'] },
  { eco: 'C50', name: 'Italian Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C55', name: 'Two Knights Defence', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C57', name: 'Two Knights: Fried Liver Attack', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5'] },
  { eco: 'C60', name: 'Ruy Lopez', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C68', name: 'Ruy Lopez: Exchange Variation', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6'] },
  { eco: 'C54', name: 'Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
  { eco: 'C65', name: 'Berlin Defence', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'B20', name: 'Sicilian Defence', moves: ['e4', 'c5'] },
  { eco: 'B23', name: 'Closed Sicilian', moves: ['e4', 'c5', 'Nc3'] },
  { eco: 'B01', name: 'Scandinavian Defence', moves: ['e4', 'd5'] },
  { eco: 'B06', name: 'Modern Defence', moves: ['e4', 'g6'] },
  { eco: 'B07', name: 'Pirc Defence', moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B40', name: 'Sicilian Defence: French Variation', moves: ['e4', 'c5', 'Nf3', 'e6'] },
  { eco: 'B50', name: 'Sicilian: Modern Variations', moves: ['e4', 'c5', 'Nf3', 'd6'] },
  { eco: 'B33', name: 'Sicilian: Sveshnikov Variation', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'] },
  { eco: 'C00', name: 'French Defence', moves: ['e4', 'e6'] },
  { eco: 'C10', name: 'French: Classical Variation', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'] },
  { eco: 'B10', name: 'Caro-Kann Defence', moves: ['e4', 'c6'] },
  { eco: 'B12', name: 'Caro-Kann: Advance Variation', moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'C44', name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C25', name: 'Vienna Game', moves: ['e4', 'e5', 'Nc3'] },
  { eco: 'D00', name: "Queen's Pawn Game", moves: ['d4'] },
  { eco: 'D02', name: 'London System', moves: ['d4', 'Nf6', 'Nf3', 'd5', 'Bf4'] },
  { eco: 'D04', name: "Queen's Pawn: Colle System", moves: ['d4', 'Nf6', 'Nf3', 'e6', 'e3'] },
  { eco: 'A45', name: 'Trompowsky Attack', moves: ['d4', 'Nf6', 'Bg5'] },
  { eco: 'D06', name: "Queen's Gambit", moves: ['d4', 'd5', 'c4'] },
  { eco: 'D30', name: "Queen's Gambit Declined", moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D10', name: 'Slav Defence', moves: ['d4', 'd5', 'c4', 'c6'] },
  { eco: 'E20', name: 'Nimzo-Indian Defence', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E60', name: "King's Indian Defence", moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'E12', name: "Queen's Indian Defence", moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'] },
  { eco: 'E15', name: 'Catalan Opening', moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'] },
  { eco: 'A10', name: 'English Opening', moves: ['c4'] },
  { eco: 'A30', name: 'English Opening: Symmetrical Variation', moves: ['c4', 'c5'] },
  { eco: 'A25', name: 'English Opening: Closed Variation', moves: ['c4', 'e5', 'Nc3'] },
  { eco: 'A04', name: 'Réti Opening', moves: ['Nf3'] },
  { eco: 'A00', name: 'Bird Opening', moves: ['f4'] },
  { eco: 'A80', name: 'Dutch Defence', moves: ['d4', 'f5'] },
]

export function matchOpening(moves: string[]) {
  let match: OpeningRecord | undefined
  for (const opening of OPENINGS) {
    if (opening.moves.length <= (match?.moves.length ?? 0) || opening.moves.length > moves.length) continue
    if (opening.moves.every((move, index) => move === moves[index])) match = opening
  }
  return match ?? null
}

export function detectOpening(moves: string[]) {
  const match = matchOpening(moves)
  if (match) return match.name
  if (moves[0]?.startsWith('e4')) return "King's Pawn Opening"
  if (moves[0]?.startsWith('d4')) return "Queen's Pawn Opening"
  if (moves[0] === 'c4') return 'English Opening'
  if (moves[0] === 'Nf3') return 'Réti Opening'
  if (moves[0] === 'f4') return 'Bird Opening'
  return 'Unclassified'
}