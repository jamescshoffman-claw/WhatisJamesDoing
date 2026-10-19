// Simulation test: run 12 and 16 team formats from pools through the grand final using only logic.ts.
// Run: node --experimental-strip-types src/balloween/sim.test.ts
import { assignPools, buildPoolMatches, buildBracket, reconcile, applyPatches, seedTeams, rulesFor, winnerFromSets,
  champion, poolsComplete, currentPlayoffMatch, teamLosses, netsFor, roundRobin, seedOrder, parseTeamsCsv, bracketSize, type Team, type Match, type Format } from './logic.ts'
import { sampleTeams, randomSet } from './sample.ts'

let seed = 7
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
let idc = 0
const uid = () => `id${++idc}`
const assert = (c: unknown, msg: string) => { if (!c) { console.error('FAIL:', msg); process.exit(1) } }

function play(m: Match): [number, number][] {
  const r = rulesFor(m); const sets: [number, number][] = []
  while (winnerFromSets(sets, r) === null) sets.push(randomSet(r.target, r.winBy2, rand))
  return sets
}

function runFormat(format: Format, nTeams: number) {
  const pool = sampleTeams()
  let teams: Team[] = Array.from({ length: nTeams }, (_, k) => { const p = pool[k % pool.length]; return { id: uid(), t: 'test', format, player1: p.player1, player2: p.player2, name: `${p.player1.split(' ')[0]} & ${p.player2.split(' ')[0]} ${k}`, pool: null, seed: null } })
  const pools = assignPools(teams, rand)
  teams = teams.map(t => ({ ...t, pool: pools[t.id] }))
  const sizes = Object.values(teams.reduce((acc, t) => { acc[t.pool!] = (acc[t.pool!] || 0) + 1; return acc }, {} as Record<string, number>))
  let matches: Match[] = buildPoolMatches('test', format, teams).map(m => ({ ...m, id: uid() }))
  const expectedPool = sizes.reduce((s, k) => s + (k * (k - 1)) / 2, 0)
  assert(matches.length === expectedPool, `${format}: pool match count ${matches.length} != ${expectedPool}`)
  const perTeam = teams.map(t => matches.filter(m => m.team_a === t.id || m.team_b === t.id).length)
  for (const m of matches) matches = matches.map(x => x.id === m.id ? { ...x, sets: play(x), winner: null } : x)
  matches = matches.map(m => ({ ...m, winner: winnerFromSets(m.sets, rulesFor(m)) === 'a' ? m.team_a : m.team_b }))
  assert(poolsComplete(matches, format), `${format}: pools should be complete`)

  const seeded = seedTeams(teams, matches)
  assert(seeded.length === nTeams, `${format}: seeded ${seeded.length}`)
  teams = teams.map(t => ({ ...t, seed: seeded.findIndex(s => s.id === t.id) + 1 }))
  const bracket = buildBracket('test', format, nTeams).map(m => ({ ...m, id: uid() }))
  matches = [...matches, ...bracket]
  matches = applyPatches(matches, reconcile(matches, teams, format, '2026-01-01T00:00:00Z'))

  const byes = matches.filter(m => m.stage === 'wb' && m.round === 1 && m.winner && m.sets.length === 0).length
  assert(byes === bracketSize(nTeams) - nTeams, `${format}: byes ${byes} != ${bracketSize(nTeams) - nTeams}`)
  const nets = netsFor(format)
  let played = 0, tick = 0, maxConcurrent = 0
  while (!champion(matches, format)) {
    const live = matches.filter(m => m.stage !== 'pool' && m.team_a && m.team_b && !m.winner && !m.void)
    const onNet = live.filter(m => m.net)
    maxConcurrent = Math.max(maxConcurrent, onNet.length)
    assert(onNet.length <= nets.length, `${format}: too many matches on nets`)
    assert(new Set(onNet.map(m => m.net)).size === onNet.length, `${format}: duplicate net assignment`)
    assert(onNet.length > 0, `${format}: deadlock — nobody on a net but no champion (tick ${tick})`)
    const m = onNet[Math.floor(rand() * onNet.length)]
    const sets = play(m)
    const w = winnerFromSets(sets, rulesFor(m)) === 'a' ? m.team_a : m.team_b
    matches = matches.map(x => x.id === m.id ? { ...x, sets, winner: w } : x)
    matches = applyPatches(matches, reconcile(matches, teams, format, `2026-01-01T00:00:${String(tick % 60).padStart(2, '0')}Z`))
    played++; tick++
    assert(tick < 500, 'runaway loop')
  }
  const champ = teams.find(t => t.id === champion(matches, format))!
  const losses = teams.map(t => teamLosses(t.id, matches))
  assert(losses.every(l => l <= 2), `${format}: a team lost 3 times`)
  assert(losses.filter(l => l < 2).length === 1 && teamLosses(champ.id, matches) <= 1, `${format}: only the champion may have fewer than 2 losses`)
  const gf2 = matches.find(m => m.stage === 'gf2')!
  const gfLossesChamp = teamLosses(champ.id, matches)
  console.log(`${format} (${nTeams} teams): pools ${sizes.join('/')} → ${expectedPool} pool games, games per team ${Math.min(...perTeam)}-${Math.max(...perTeam)}; ` +
    `${byes} byes; ${played} playoff games; rematch ${gf2.void ? 'not needed' : 'played'}; max concurrent ${maxConcurrent}; champion seed ${champ.seed} (${champ.name}, ${gfLossesChamp} loss)`)
  for (const t of teams) assert(currentPlayoffMatch(t.id, matches) === null, 'everyone should be finished')

  // Admin fixes a winners-round-1 result after the tournament ended: everything downstream must reopen, then replay to a champion.
  const first = matches.find(m => m.stage === 'wb' && m.round === 1 && m.sets.length)!
  const flipped = first.sets.map(([x, y]) => [y, x] as [number, number])
  const nw = winnerFromSets(flipped, rulesFor(first)) === 'a' ? first.team_a : first.team_b
  matches = matches.map(x => x.id === first.id ? { ...x, sets: flipped, winner: nw } : x)
  matches = applyPatches(matches, reconcile(matches, teams, format, '2026-01-02T00:00:00Z'))
  assert(champion(matches, format) === null, `${format}: editing an early result must reopen the bracket`)
  const reopened = matches.filter(m => m.stage !== 'pool' && !m.winner && !m.void).length
  assert(reopened > 5, `${format}: expected downstream matches to reopen, got ${reopened}`)
  let guard = 0
  while (!champion(matches, format)) {
    const onNet = matches.filter(m => m.stage !== 'pool' && m.team_a && m.team_b && !m.winner && !m.void && m.net)
    assert(onNet.length > 0, `${format}: deadlock after edit`)
    const m = onNet[0]; const sets = play(m)
    matches = matches.map(x => x.id === m.id ? { ...x, sets, winner: winnerFromSets(sets, rulesFor(m)) === 'a' ? m.team_a : m.team_b } : x)
    matches = applyPatches(matches, reconcile(matches, teams, format, `2026-01-02T00:01:${String(guard % 60).padStart(2, '0')}Z`))
    assert(++guard < 200, 'runaway after edit')
  }
  assert(teams.every(t => teamLosses(t.id, matches) <= 2), `${format}: 3 losses after edit replay`)
  console.log(`   edit test: ${reopened} matches reopened, ${guard} replayed, new champion seed ${teams.find(t => t.id === champion(matches, format))!.seed}`)
}

assert(JSON.stringify(seedOrder(8)) === '[1,8,4,5,2,7,3,6]', 'seed order')
assert(roundRobin(['a', 'b', 'c', 'd']).length === 6 && roundRobin(['a', 'b', 'c']).length === 3, 'round robin')
const csv = parseTeamsCsv('Player 1,Player 2,Format\nAnn Lee,Bo Kim,Men\n"Cy Ng", Di Wu, women\nbad line')
assert(csv.teams.length === 2 && csv.errors.length === 1 && csv.teams[1].format === 'women', 'csv parse')
for (let i = 0; i < 5; i++) { runFormat('men', 12); runFormat('women', 16) }
// Both formats in one table at once: men's seeds must never resolve to women's teams (the bug found on the live site).
{
  const mk = (format: Format, n: number) => Array.from({ length: n }, (_, k) => ({ id: uid(), t: 'test', format, player1: `p${k}`, player2: `q${k}`, name: `${format}${k}`, pool: 'A', seed: k + 1 }) as Team)
  const teams = [...mk('men', 12), ...mk('women', 16)]
  const matches: Match[] = [...buildBracket('test', 'men', 12), ...buildBracket('test', 'women', 16)].map(m => ({ ...m, id: uid() }))
  const after = applyPatches(matches, reconcile(matches, teams, 'men'))
  const menIds = new Set(teams.filter(t => t.format === 'men').map(t => t.id))
  for (const m of after.filter(m => m.format === 'men' && m.stage === 'wb' && m.round === 1)) {
    assert((!m.team_a || menIds.has(m.team_a)) && (!m.team_b || menIds.has(m.team_b)), 'men bracket must only contain men teams')
  }
  assert(after.filter(m => m.format === 'men' && m.stage === 'wb' && m.round === 1 && m.winner && !m.sets.length).length === 4, 'mixed-format byes')
  console.log('mixed-format seeding ok')
}
runFormat('men', 13); runFormat('men', 8); runFormat('women', 5)
console.log('ALL SIMULATIONS PASSED')
