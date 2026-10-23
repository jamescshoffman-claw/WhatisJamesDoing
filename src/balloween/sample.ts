import { parseTeamsCsv, type Format, type ParsedTeam } from './logic.ts'

/** The real roster and pool assignments (men updated Oct 23, 2026). Pools A-D; men play on nets A-D, women on E-H. */
const ROSTER = `Team Name	Player 1 Name	Player 2 Name	Format	Pool
freelo	Jeffrey Li	Leo Wu	Mens	A
Chamelons	Kevin Chau	Josh Seol	Mens	A
Pigs CAN Fly	Lucas Palmer	Ariel Zhang	Mens	A
Vollibros	Evan Li	Austin Li	Mens	A
100 gecs	Vikas	James Hoffman	Mens	B
Where are hands	Johnny luu	Farrah suprijanto	Mens	B
Brotato	Jonathan Xue	Harrison Ly	Mens	B
dig bick	Edward	By	Mens	B
Joust Kidding	Joseph Xiao	Darren Li	Mens	C
The Goofy Goobers	Samuel Zhang	Fred Li	Mens	C
BOOM BOOM BOOM	Stanley Qiu	Timothy Liu	Mens	C
Jumpsets	Richard Cho	Joseph Drahos	Mens	C
Lucha Libre Legends	Will Spangler	Abi Dozic	Mens	D
x	Luke Choe	Alex Chau	Mens	D
Oh Deer	Tobias Krause	Nicole	Mens	D
Soft Serve	Dan Qi	Lucas Huangs	Mens	D
Mickey Mouse 🐭	Wen	Seohee	Womens	A
Doubles and Vibes	James Zhang	Grace Qian	Womens	A
Hwaboon	TC Qin	Jana Tse	Womens	A
2 big fat pumpkins	Paige Jansky	Sophia He	Womens	A
Nai bros	Lucy	Yingying	Womens	B
nice aunt and unc	Daniel Tong	Shirley Wang	Womens	B
Eternal Destruction	Nathan Wang	Nicole Doerges	Womens	B
Vertically challenged	Eduarda gray	Vanessa Nagoya	Womens	B
Smaggie	Maggie	Sam	Womens	C
shawSHANK Redemption	Kristen Henry	Bobby Nilsen	Womens	C
Kim Impossible	Anna Lok	Jade Chan	Womens	C
Crankdat Afters	Brendan Feng	Amira McCants	Womens	C
Blue Balls	Katie Chang	Carly Cooper	Womens	D
hi im new	Curtis Yu	Sabrina Lin	Womens	D
PARK at KIMS	David Kim	Angela Park	Womens	D
Nai sisters	Karen Guo	Whitney Tran	Womens	D`

/** The real roster, padded with "Sample Player" teams only if a net is short of 16. */
export function sampleTeams(target = 16): ParsedTeam[] {
  const { teams } = parseTeamsCsv(ROSTER)
  let n = 0
  for (const format of ['men', 'women'] as Format[]) {
    while (teams.filter(t => t.format === format).length < target) {
      n++
      teams.push({ player1: `Sample Player ${2 * n - 1}`, player2: `Sample Player ${2 * n}`, format, name: `Sample Team ${n}` })
    }
  }
  return teams
}

/** A plausible random set score for the given target. */
export function randomSet(target: number, winBy2: boolean, rand: () => number = Math.random): [number, number] {
  const aWins = rand() < 0.5
  let loser = Math.floor(rand() * target)
  if (winBy2 && loser >= target - 1 && rand() < 0.6) loser = target - 1 // occasional deuce
  const winner = winBy2 && loser >= target - 1 ? loser + 2 : target
  return aWins ? [winner, loser] : [loser, winner]
}
