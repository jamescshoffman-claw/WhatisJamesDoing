import type { Format } from './logic'

const FIRST = ['Ava', 'Ben', 'Chloe', 'Dan', 'Ella', 'Finn', 'Grace', 'Hank', 'Ivy', 'Jack', 'Kara', 'Leo', 'Mia', 'Noah', 'Olive', 'Pete',
  'Quinn', 'Rosa', 'Sam', 'Tess', 'Uma', 'Vic', 'Wren', 'Xavi', 'Yara', 'Zed', 'Amir', 'Bea', 'Cole', 'Dina', 'Eli', 'Faye',
  'Gus', 'Hana', 'Ike', 'Jade', 'Kai', 'Lena', 'Max', 'Nia', 'Omar', 'Pia', 'Reed', 'Sara', 'Theo', 'Una', 'Vera', 'Will',
  'Yuki', 'Zara', 'Ash', 'Bree', 'Cruz', 'Dove', 'Enzo', 'Fern']
const LAST = ['Adams', 'Baker', 'Cruz', 'Diaz', 'Evans', 'Ford', 'Gray', 'Hale', 'Irwin', 'Jones', 'Kim', 'Lee', 'Moss', 'Nash', 'Ortiz', 'Park',
  'Quist', 'Reyes', 'Shaw', 'Tran', 'Usher', 'Vance', 'Wu', 'Xu', 'Young', 'Zane', 'Abe', 'Bell', 'Cook', 'Dunn', 'Egan', 'Fox',
  'Goss', 'Hart', 'Ito', 'Jain', 'Kent', 'Lowe', 'Mack', 'Noel', 'Owen', 'Pyle', 'Rood', 'Sato', 'Tate', 'Ueda', 'Vogt', 'Webb',
  'York', 'Zhu', 'Ames', 'Bass', 'Cobb', 'Dale', 'Eads', 'Fay']

/** 12 men's teams and 16 women's teams, so the test exercises both the bye-heavy and the full bracket. */
export function sampleTeams(): { player1: string; player2: string; format: Format }[] {
  const out: { player1: string; player2: string; format: Format }[] = []
  let i = 0
  const take = () => { const n = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`; i++; return n }
  for (let k = 0; k < 12; k++) out.push({ player1: take(), player2: take(), format: 'men' })
  for (let k = 0; k < 16; k++) out.push({ player1: take(), player2: take(), format: 'women' })
  return out
}

/** A plausible random set score for the given target. */
export function randomSet(target: number, winBy2: boolean, rand: () => number = Math.random): [number, number] {
  const aWins = rand() < 0.5
  let loser = Math.floor(rand() * target)
  if (winBy2 && loser >= target - 1 && rand() < 0.6) loser = target - 1 // occasional deuce
  const winner = winBy2 && loser >= target - 1 ? loser + 2 : target
  return aWins ? [winner, loser] : [loser, winner]
}
