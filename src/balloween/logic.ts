// Pure tournament logic for Balloween: pools, standings, seeding, double-elimination bracket, reconciliation.
// No React, no Supabase here so it can be unit-tested with plain Node.

export type TKey = 'live' | 'test'
export type Format = 'men' | 'women'
export type Stage = 'pool' | 'wb' | 'lb' | 'gf' | 'gf2'
export type Phase = 'setup' | 'pools' | 'preview' | 'playoffs'

export type Src =
  | { type: 'seed'; seed: number }
  | { type: 'winner'; key: string }
  | { type: 'loser'; key: string }

export interface Team {
  id: string
  t: string
  format: Format
  player1: string
  player2: string
  name: string
  pool: string | null
  seed: number | null
}

export interface Match {
  id: string
  t: string
  format: Format
  key: string
  stage: Stage
  round: number
  slot: number
  pool: string | null
  net: string | null
  team_a: string | null
  team_b: string | null
  src_a: Src | null
  src_b: Src | null
  sets: [number, number][]
  winner: string | null
  void: boolean
  ready_at: string | null
}

export interface FormatState { t: string; format: Format; phase: Phase; pool_cap?: number | null }

export const FORMAT_LABEL: Record<Format, string> = { men: "Men's net", women: "Women's net" }
export const NET_PREFIX: Record<Format, string> = { men: 'M', women: 'W' }
export const NETS_PER_FORMAT = 4
export const POOL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** Nets are lettered to match the pools: pool A plays on net A. Each format has its own A-D. */
export function netsFor(_format: Format): string[] {
  return POOL_LETTERS.slice(0, NETS_PER_FORMAT)
}

/** Halloween names for the pools. Net letters stay A-D so the signs on the nets are simple. */
export const POOL_NAMES: Record<Format, Record<string, string>> = {
  men: { A: 'Pumpkin', B: 'Werewolf', C: 'Skeleton', D: 'Mummy' },
  women: { A: 'Witch', B: 'Vampire', C: 'Ghost', D: 'Zombie' },
}
export function poolName(format: Format, pool: string | null | undefined): string {
  if (!pool) return ''
  const n = POOL_NAMES[format]?.[pool]
  return n ? `${n} pool` : `Pool ${pool}`
}

export function teamName(p1: string, p2: string): string {
  const first = (s: string) => s.trim().split(/\s+/)[0]
  return `${first(p1)} & ${first(p2)}`
}

// ---------------------------------------------------------------- rules

/** `cap` is a hard ceiling on a set score: the first team to reach it wins, no win-by-2 past it. */
export interface Rules { bestOf: 1 | 3; target: number; winBy2: boolean; cap?: number; label: string }

/** Pool games are one set to this many points unless the admin sets another cap. */
export const DEFAULT_POOL_CAP = 21
export const MIN_POOL_CAP = 5
export const MAX_POOL_CAP = 50

/** The pool cap in play for a format (admin setting in bw_state), or the default. */
export function poolCapOf(states: FormatState[], format: Format): number {
  const v = states.find(s => s.format === format)?.pool_cap
  return typeof v === 'number' && v >= MIN_POOL_CAP && v <= MAX_POOL_CAP ? v : DEFAULT_POOL_CAP
}

export function rulesFor(m: Pick<Match, 'stage' | 'round'>, poolCap = DEFAULT_POOL_CAP): Rules {
  if (m.stage === 'pool') return { bestOf: 1, target: poolCap, winBy2: false, cap: poolCap, label: `One set to ${poolCap}, cap at ${poolCap} (first to ${poolCap} wins, no win by 2)` }
  if (m.stage === 'wb' && m.round === 1) return { bestOf: 1, target: 30, winBy2: false, label: 'One set to 30, no cap' }
  if (m.stage === 'gf' || m.stage === 'gf2') return { bestOf: 3, target: 21, winBy2: true, label: 'Best of 3 sets to 21, win by 2' }
  return { bestOf: 3, target: 15, winBy2: true, label: 'Best of 3 sets to 15, win by 2' }
}

/** Winner side ('a' | 'b') from sets, or null if the result is incomplete/invalid. */
export function winnerFromSets(sets: [number, number][], rules: Rules): 'a' | 'b' | null {
  const need = rules.bestOf === 1 ? 1 : 2
  let a = 0, b = 0
  for (const [x, y] of sets) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x === y) return null
    if (x > y) a++; else b++
    if (a === need) return b < need ? 'a' : null
    if (b === need) return 'b'
  }
  return null
}

export function setsSummary(sets: [number, number][], perspectiveA = true): string {
  return sets.map(([a, b]) => (perspectiveA ? `${a}-${b}` : `${b}-${a}`)).join(', ')
}

// ---------------------------------------------------------------- pools

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function poolCount(n: number): number {
  if (n >= 12) return 4
  if (n >= 9) return 3
  if (n >= 5) return 2
  return 1
}

/** Returns pool letter per team id, dealt round-robin after a shuffle so sizes stay balanced (13 → 4,3,3,3). */
export function assignPools(teams: Team[], rand: () => number = Math.random): Record<string, string> {
  const n = poolCount(teams.length)
  const out: Record<string, string> = {}
  shuffle(teams, rand).forEach((t, i) => { out[t.id] = POOL_LETTERS[i % n] })
  return out
}

export function poolNet(_format: Format, pool: string): string {
  return pool
}

/** Round-robin pairings in an order that spreads each team's games out (circle method). */
export function roundRobin(ids: string[]): [string, string][] {
  const list: (string | null)[] = ids.slice()
  if (list.length % 2 === 1) list.push(null)
  const n = list.length
  const pairs: [string, string][] = []
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const x = list[i], y = list[n - 1 - i]
      if (x && y) pairs.push(r % 2 === 0 ? [x, y] : [y, x])
    }
    list.splice(1, 0, list.pop()!)
  }
  return pairs
}

export function buildPoolMatches(t: string, format: Format, teams: Team[]): Omit<Match, 'id'>[] {
  const byPool: Record<string, Team[]> = {}
  for (const tm of teams) if (tm.pool) (byPool[tm.pool] ||= []).push(tm)
  const out: Omit<Match, 'id'>[] = []
  for (const pool of Object.keys(byPool).sort()) {
    roundRobin(byPool[pool].map(x => x.id)).forEach(([a, b], i) => {
      out.push({
        t, format, key: `${format}-pool-${pool}-${i + 1}`, stage: 'pool', round: 1, slot: i, pool,
        net: poolNet(format, pool), team_a: a, team_b: b, src_a: null, src_b: null, sets: [], winner: null, void: false,
        ready_at: null,
      })
    })
  }
  return out
}

// ---------------------------------------------------------------- standings & seeding

export interface Line { team: Team; played: number; wins: number; losses: number; pf: number; pa: number; diff: number; pct: number }

export function poolLines(teams: Team[], matches: Match[]): Line[] {
  const lines = new Map<string, Line>()
  for (const team of teams) lines.set(team.id, { team, played: 0, wins: 0, losses: 0, pf: 0, pa: 0, diff: 0, pct: 0 })
  for (const m of matches) {
    if (m.stage !== 'pool' || !m.winner || !m.team_a || !m.team_b) continue
    const A = lines.get(m.team_a), B = lines.get(m.team_b)
    if (!A || !B) continue
    let pa = 0, pb = 0
    for (const [x, y] of m.sets) { pa += x; pb += y }
    A.played++; B.played++; A.pf += pa; A.pa += pb; B.pf += pb; B.pa += pa
    if (m.winner === m.team_a) { A.wins++; B.losses++ } else { B.wins++; A.losses++ }
  }
  for (const l of lines.values()) { l.diff = l.pf - l.pa; l.pct = l.played ? l.wins / l.played : 0 }
  return [...lines.values()]
}

function headToHead(a: Team, b: Team, matches: Match[]): number {
  const m = matches.find(x => x.stage === 'pool' && x.winner && ((x.team_a === a.id && x.team_b === b.id) || (x.team_a === b.id && x.team_b === a.id)))
  if (!m) return 0
  return m.winner === a.id ? -1 : 1
}

/** Pool table order: win %, head-to-head (two-way ties), point differential, points for, name. */
export function rankPool(teams: Team[], matches: Match[]): Line[] {
  const lines = poolLines(teams, matches)
  return lines.sort((x, y) => {
    if (y.pct !== x.pct) return y.pct - x.pct
    if (y.wins !== x.wins) return y.wins - x.wins
    const tiedGroup = lines.filter(l => l.pct === x.pct && l.wins === x.wins)
    if (tiedGroup.length === 2) {
      const h = headToHead(x.team, y.team, matches)
      if (h) return h
    }
    if (y.diff !== x.diff) return y.diff - x.diff
    if (y.pf !== x.pf) return y.pf - x.pf
    return x.team.name.localeCompare(y.team.name)
  })
}

/** Seeds: pool winners first (ordered by win %, diff, pf), then runners-up, and so on. */
export function seedTeams(teams: Team[], matches: Match[]): Team[] {
  const pools = [...new Set(teams.map(t => t.pool).filter(Boolean))].sort() as string[]
  const ranked = pools.map(p => rankPool(teams.filter(t => t.pool === p), matches.filter(m => m.pool === p)))
  const maxLen = Math.max(0, ...ranked.map(r => r.length))
  const seeded: Team[] = []
  for (let pos = 0; pos < maxLen; pos++) {
    const tier = ranked.map(r => r[pos]).filter(Boolean)
    tier.sort((x, y) => y.pct - x.pct || y.diff - x.diff || y.pf - x.pf || x.team.name.localeCompare(y.team.name))
    seeded.push(...tier.map(l => l.team))
  }
  return seeded
}

// ---------------------------------------------------------------- double elimination

export function bracketSize(n: number): number {
  let b = 4
  while (b < n) b *= 2
  return b
}

/** Standard seed order for a bracket of size B: 1,B,B/2,B/2+1,... so 1 and 2 meet last. */
export function seedOrder(B: number): number[] {
  let order = [1]
  while (order.length < B) {
    const len = order.length * 2
    const next: number[] = []
    for (const s of order) next.push(s, len + 1 - s)
    order = next
  }
  return order
}

export function roundLabel(m: Pick<Match, 'stage' | 'round'>, n: number): string {
  const B = bracketSize(n), R = Math.log2(B)
  if (m.stage === 'pool') return 'Pool play'
  if (m.stage === 'gf') return 'Grand final'
  if (m.stage === 'gf2') return 'Grand final (deciding match)'
  if (m.stage === 'wb') {
    if (m.round === R) return 'Winners bracket final'
    if (m.round === R - 1) return 'Winners bracket semifinal'
    return `Winners bracket round ${m.round}`
  }
  const L = 2 * (R - 1)
  if (m.round === L) return 'Losers bracket final'
  if (m.round === L - 1) return 'Losers bracket semifinal'
  return `Losers bracket round ${m.round}`
}

function blank(t: string, format: Format, key: string, stage: Stage, round: number, slot: number, src_a: Src, src_b: Src): Omit<Match, 'id'> {
  return { t, format, key, stage, round, slot, pool: null, net: null, team_a: null, team_b: null, src_a, src_b, sets: [], winner: null, void: false, ready_at: null }
}

/** All playoff matches for n seeded teams: winners bracket, losers bracket, grand final and the conditional rematch. */
export function buildBracket(t: string, format: Format, n: number): Omit<Match, 'id'>[] {
  const B = bracketSize(n), R = Math.log2(B)
  const F = format
  const out: Omit<Match, 'id'>[] = []
  const order = seedOrder(B)
  for (let i = 0; i < B / 2; i++) {
    out.push(blank(t, F, `${F}-wb-1-${i}`, 'wb', 1, i, { type: 'seed', seed: order[2 * i] }, { type: 'seed', seed: order[2 * i + 1] }))
  }
  for (let r = 2; r <= R; r++) {
    const count = B / 2 ** r
    for (let i = 0; i < count; i++) {
      out.push(blank(t, F, `${F}-wb-${r}-${i}`, 'wb', r, i, { type: 'winner', key: `${F}-wb-${r - 1}-${2 * i}` }, { type: 'winner', key: `${F}-wb-${r - 1}-${2 * i + 1}` }))
    }
  }
  // Losers bracket round 1: losers of winners round 1 play each other.
  for (let i = 0; i < B / 4; i++) {
    out.push(blank(t, F, `${F}-lb-1-${i}`, 'lb', 1, i, { type: 'loser', key: `${F}-wb-1-${2 * i}` }, { type: 'loser', key: `${F}-wb-1-${2 * i + 1}` }))
  }
  for (let k = 1; k <= R - 1; k++) {
    // Even round 2k: losers bracket survivors meet the losers dropping from winners round k+1 (reversed to avoid rematches).
    const count = B / 2 ** (k + 1)
    for (let i = 0; i < count; i++) {
      out.push(blank(t, F, `${F}-lb-${2 * k}-${i}`, 'lb', 2 * k, i, { type: 'winner', key: `${F}-lb-${2 * k - 1}-${i}` }, { type: 'loser', key: `${F}-wb-${k + 1}-${count - 1 - i}` }))
    }
    // Odd round 2k+1: losers bracket winners play each other (not after the last even round).
    if (k <= R - 2) {
      for (let i = 0; i < count / 2; i++) {
        out.push(blank(t, F, `${F}-lb-${2 * k + 1}-${i}`, 'lb', 2 * k + 1, i, { type: 'winner', key: `${F}-lb-${2 * k}-${2 * i}` }, { type: 'winner', key: `${F}-lb-${2 * k}-${2 * i + 1}` }))
      }
    }
  }
  const L = 2 * (R - 1)
  out.push(blank(t, F, `${F}-gf`, 'gf', 1, 0, { type: 'winner', key: `${F}-wb-${R}-0` }, { type: 'winner', key: `${F}-lb-${L}-0` }))
  // The rematch is only played if the losers-bracket team wins the first grand final; reconcile() fills or voids it.
  out.push(blank(t, F, `${F}-gf2`, 'gf2', 1, 0, { type: 'winner', key: `${F}-gf` }, { type: 'loser', key: `${F}-gf` }))
  return out
}

export type MatchPatch = Partial<Pick<Match, 'team_a' | 'team_b' | 'winner' | 'void' | 'net' | 'ready_at' | 'sets'>>

/**
 * Fill in teams from sources, auto-complete byes, void dead matches, handle the grand-final rematch and hand out nets.
 * Returns patches keyed by match key. Pure: pass the current matches (already merged with any pending patches).
 */
export function reconcile(matches: Match[], teams: Team[], format: Format, now: string = new Date().toISOString()): Record<string, MatchPatch> {
  const bySeed = new Map<number, string>()
  for (const tm of teams) if (tm.seed && tm.format === format) bySeed.set(tm.seed, tm.id)  // seeds are per format
  const ms = matches.filter(m => m.format === format && m.stage !== 'pool').map(m => ({ ...m }))
  const byKey = new Map(ms.map(m => [m.key, m]))
  const patches: Record<string, MatchPatch> = {}
  const patch = (m: Match, p: MatchPatch) => { Object.assign(m, p); patches[m.key] = { ...(patches[m.key] || {}), ...p } }
  const done = (m: Match) => !!m.winner || m.void

  // undefined = not decided yet; null = nobody (bye)
  const resolve = (src: Src | null): string | null | undefined => {
    if (!src) return null
    if (src.type === 'seed') return bySeed.get(src.seed) ?? null
    const s = byKey.get(src.key)
    if (!s || !done(s)) return undefined
    if (src.type === 'winner') return s.winner
    if (s.void || !s.winner) return null
    const loser = s.winner === s.team_a ? s.team_b : s.team_a
    return loser ?? null
  }

  const reset = (m: Match, a: string | null | undefined, b: string | null | undefined) => {
    patch(m, { team_a: a === undefined ? m.team_a : a, team_b: b === undefined ? m.team_b : b, sets: [], winner: null, void: false, ready_at: null, net: null })
  }

  for (let pass = 0; pass < 30; pass++) {
    let changed = false
    for (const m of ms) {
      let a: string | null | undefined, b: string | null | undefined
      if (m.stage === 'gf2') {
        const gf = byKey.get(m.key.replace(/gf2$/, 'gf'))
        if (!gf || !done(gf)) {
          // Grand final not decided (or reopened by an edit): the rematch must be blank.
          if (m.void || m.winner || m.team_a || m.team_b) { reset(m, null, null); changed = true }
          continue
        }
        // Winners-bracket champion sits in team_a of the grand final. If they won, no rematch.
        if (gf.void || gf.winner === gf.team_a) {
          if (!m.void) { patch(m, { void: true, team_a: null, team_b: null, sets: [], winner: null, net: null, ready_at: null }); changed = true }
          continue
        }
        a = gf.team_a; b = gf.team_b
        if (m.void) { reset(m, a, b); changed = true; continue }
      } else {
        a = resolve(m.src_a); b = resolve(m.src_b)
      }
      // Expected teams right now: an undecided source means "nobody yet". If they differ from what is stored,
      // a result upstream was edited (or this match was reached early): wipe it and re-derive.
      const ea = a === undefined ? null : a, eb = b === undefined ? null : b
      if (ea !== m.team_a || eb !== m.team_b) {
        if (done(m)) { reset(m, ea, eb); changed = true; continue }
        patch(m, { team_a: ea, team_b: eb, ...(a === undefined || b === undefined ? { ready_at: null, net: null } : {}) }); changed = true
      }
      if (done(m)) continue
      const p: MatchPatch = {}
      if (a !== undefined && b !== undefined) {
        if (a === null && b === null) p.void = true
        else if (a === null) p.winner = b
        else if (b === null) p.winner = a
        else if (!m.ready_at) p.ready_at = now
      }
      if (Object.keys(p).length) { patch(m, p); changed = true }
    }
    if (!changed) break
  }

  // Nets: matches with two teams and no result queue up in the order they became ready; first free net wins.
  const nets = netsFor(format)
  const live = ms.filter(m => m.team_a && m.team_b && !done(m))
  const busy = new Set(live.filter(m => m.net).map(m => m.net!))
  const queue = live.filter(m => !m.net).sort((x, y) => (x.ready_at || '').localeCompare(y.ready_at || '') || stageRank(x) - stageRank(y) || x.round - y.round || x.slot - y.slot)
  for (const m of queue) {
    const free = nets.find(n => !busy.has(n))
    if (!free) break
    busy.add(free)
    patch(m, { net: free })
  }
  // A finished match frees its net for the next one; clearing keeps "who is on which net" readable.
  for (const m of ms) if (done(m) && m.net) patch(m, { net: null })
  return patches
}

function stageRank(m: Match): number { return m.stage === 'gf2' ? 4 : m.stage === 'gf' ? 3 : m.stage === 'wb' ? 1 : 2 }

export function applyPatches(matches: Match[], patches: Record<string, MatchPatch>): Match[] {
  return matches.map(m => (patches[m.key] ? { ...m, ...patches[m.key] } : m))
}

// ---------------------------------------------------------------- derived views

export function champion(matches: Match[], format: Format): string | null {
  const gf = matches.find(m => m.format === format && m.stage === 'gf')
  const gf2 = matches.find(m => m.format === format && m.stage === 'gf2')
  if (!gf?.winner) return null
  if (gf.winner === gf.team_a) return gf.winner
  return gf2?.winner ?? null
}

export function teamLosses(teamId: string, matches: Match[]): number {
  return matches.filter(m => m.stage !== 'pool' && m.winner && !m.void && (m.team_a === teamId || m.team_b === teamId) && m.winner !== teamId).length
}

export function poolsComplete(matches: Match[], format: Format): boolean {
  const pool = matches.filter(m => m.format === format && m.stage === 'pool')
  return pool.length > 0 && pool.every(m => !!m.winner)
}

/** The playoff match a team should care about right now: in progress, or the next one waiting on a result. */
export function currentPlayoffMatch(teamId: string, matches: Match[]): Match | null {
  const mine = matches.filter(m => m.stage !== 'pool' && !m.winner && !m.void && (m.team_a === teamId || m.team_b === teamId))
  mine.sort((x, y) => stageRank(x) - stageRank(y) || x.round - y.round)
  return mine[0] ?? null
}

/** Human description of what a pending source is waiting on, e.g. "winner of Ann & Bo vs Cy & Di". */
export function describeSrc(src: Src | null, matches: Match[], teams: Team[]): string {
  if (!src || src.type === 'seed') return 'a previous match'
  const s = matches.find(m => m.key === src.key)
  if (!s) return 'a previous match'
  const name = (id: string | null) => teams.find(t => t.id === id)?.name
  const a = name(s.team_a), b = name(s.team_b)
  const who = src.type === 'winner' ? 'winner' : 'loser'
  if (a && b) return `the ${who} of ${a} vs ${b}`
  return `the ${who} of an earlier match`
}

// ---------------------------------------------------------------- CSV

export interface ParsedTeam { player1: string; player2: string; format: Format; name?: string; pool?: string }

export function formatFromText(f: string): Format | null {
  const x = (f || '').trim().toLowerCase()
  if (/^(men|mens|men's|male|m|coed|co-ed)$/.test(x)) return 'men'          // coed plays on the men's-height net
  if (/^(women|womens|women's|female|w|f|revco|reverse coed|reverse co-ed|rev)$/.test(x)) return 'women'
  if (/^m/.test(x) || /coed/.test(x)) return 'men'
  if (/^w|^f|rev/.test(x)) return 'women'
  return null
}

/**
 * Accepts either "Player 1, Player 2, Format[, Team name]" or a pasted sign-up sheet whose header row names
 * the columns (e.g. "Team Name", "Player 1 Name", "Player 2 Name", "Format?"). Tabs or commas.
 */
export function parseTeamsCsv(text: string): { teams: ParsedTeam[]; errors: string[] } {
  const teams: ParsedTeam[] = [], errors: string[] = []
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(l => l.trim())
  if (!lines.length) return { teams, errors }
  const split = (l: string) => (l.includes('\t') ? l.split('\t') : l.split(',')).map(c => c.trim().replace(/^"|"$/g, '').trim())
  let cols = { p1: 0, p2: 1, fmt: 2, name: 3, pool: 4 }
  let start = 0
  const head = split(lines[0]).map(c => c.toLowerCase())
  if (head.some(c => /player/.test(c))) {
    const find = (re: RegExp) => head.findIndex(c => re.test(c))
    cols = { p1: find(/player\s*1|player1|^p1/), p2: find(/player\s*2|player2|^p2/), fmt: find(/format|division|bracket|net/), name: find(/team/), pool: find(/^pool/) }
    if (cols.p1 < 0 || cols.p2 < 0 || cols.fmt < 0) errors.push('Header found but could not find Player 1, Player 2 and Format columns.')
    start = 1
  }
  for (let i = start; i < lines.length; i++) {
    const cells = split(lines[i])
    const p1 = cells[cols.p1] || '', p2 = cells[cols.p2] || '', fmt = formatFromText(cells[cols.fmt] || '')
    const rawName = cols.name >= 0 ? (cells[cols.name] || '') : ''
    const name = /^tbd$/i.test(rawName.trim()) ? '' : rawName.trim()
    if (!p1 || !p2 || !fmt) { errors.push(`Line ${i + 1}: expected Player 1, Player 2 and a format (Mens / Womens / Coed / Revco) but got "${lines[i].trim()}"`); continue }
    const poolRaw = (cols.pool >= 0 ? cells[cols.pool] || '' : '').trim().toUpperCase()
    const pool = POOL_LETTERS.includes(poolRaw) ? poolRaw : undefined
    teams.push({ player1: p1, player2: p2, format: fmt, ...(name ? { name } : {}), ...(pool ? { pool } : {}) })
  }
  return { teams, errors }
}
