import { parseTeamsCsv, type Format, type ParsedTeam } from './logic.ts'

/** Real sign-ups (as of Oct 18, 2026). Coed plays on the men's-height net, Revco on the women's-height net. */
const SIGNUPS = `Team Name	Player 1 Name	Player 2 Name	Format?
Pigs CAN Fly	Lucas Palmer	Ariel Zhang	Coed
Where are hands	Johnny luu	Farrah suprijanto	Coed
TBD	Samuel Zhang	Fred Li	Mens
Vollibros	Evan Li	Austin Li	Mens
Fighting Fire	Josh Kim	Angel Obergh	Mens
Tbd	Joseph Xiao	Darren Li	Mens
TBD	Vikas	James Hoffman	Mens
Lucha Libre Legends	Will Spangler	Abi Dozic	Mens
Soft Serve	Dan Qi	Lucas Huangs	Mens
Brotato	Jonathan Xue	Harrison Ly	Mens
Jumpsets	Richard Cho	Joseph Drahos	Mens
Chamelons	Kevin Chau	Josh Seol	Mens
Set in our ways	Foris kuang	Kevin li	Mens
freelo	Jeffrey Li	Leo Wu	Mens
Hwaboon	TC Qin	Jana Tse	Revco
Mickey Mouse 🐭	Wen	Seohee	Revco
Doubles and Vibes	James Zhang	Soomin Chun	Revco
Smaggie	Maggie	Sam	Revco
Crankdat Afters	Brendan Feng	Amira McCants	Revco
hi im new	Curtis Yu	Sabrina Lin	Revco
nice aunt and unc	Daniel Tong	Shirley Wang	Revco
Eternal Destruction	Nathan Wang	Nicole Doerges	Revco
shawSHANK Redemption	Kristen Henry	Bobby Nilsen	Revco
Nai bros	Lucy	Yingying	Womens
Nai sisters	Karen Guo	Whitney Tran	Womens
Blue Balls	Katie Chang	Carly Cooper	Womens
Vertically challened	Eduarda gray	Vanessa Nagoya	Womens
2 big fat pumpkins	Paige Jansky	Sophia He	Womens`

/** The real sign-ups, padded with "Sample Player" teams so each net has a full 16. */
export function sampleTeams(target = 16): ParsedTeam[] {
  const { teams } = parseTeamsCsv(SIGNUPS)
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
