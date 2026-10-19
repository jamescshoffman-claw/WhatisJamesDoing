// A drawn double-elimination bracket: winners bracket on top, losers bracket below, grand final at the right.
// Positions are computed from round/slot so connector lines can be drawn with plain SVG. Scrolls sideways on phones.
import { bracketSize, roundLabel, setsSummary, type Format, type Match, type Team } from './logic'
import { cx, nameOf } from './ui'

const W = 168, GAP = 36, BOX = 58, UNIT = 70, PAD = 12, LABEL = 22

interface Box { m: Match; x: number; y: number }

function layout(matches: Match[], n: number) {
  const B = bracketSize(n), R = Math.log2(B), L = 2 * (R - 1)
  const col = (c: number) => PAD + c * (W + GAP)
  const boxes: Box[] = []
  const hWB = (B / 2) * UNIT
  const wb = matches.filter(m => m.stage === 'wb')
  for (const m of wb) {
    const span = UNIT * 2 ** (m.round - 1)
    boxes.push({ m, x: col(m.round - 1), y: LABEL + span * (m.slot + 0.5) - BOX / 2 })
  }
  const gf = matches.find(m => m.stage === 'gf'), gf2 = matches.find(m => m.stage === 'gf2')
  if (gf) boxes.push({ m: gf, x: col(R), y: LABEL + hWB / 2 - BOX / 2 })
  if (gf2 && !gf2.void) boxes.push({ m: gf2, x: col(R + 1), y: LABEL + hWB / 2 - BOX / 2 })
  const topLB = LABEL + hWB + 40
  const hLB = (B / 4) * UNIT
  const lb = matches.filter(m => m.stage === 'lb')
  for (const m of lb) {
    const count = B / 2 ** (Math.floor((m.round + 1) / 2) + 1)
    boxes.push({ m, x: col(m.round - 1), y: topLB + LABEL + (hLB / count) * (m.slot + 0.5) - BOX / 2 })
  }
  const cols = Math.max(R + (gf2 && !gf2.void ? 2 : 1), L)
  return { boxes, width: col(cols) - GAP + PAD, height: topLB + LABEL + hLB + PAD, R, L, topLB, hWB }
}

export function BracketDiagram({ matches, teams, format, me, onTap }: { matches: Match[]; teams: Team[]; format: Format; me?: string | null; onTap?: (m: Match) => void }) {
  const n = teams.filter(t => t.format === format).length
  const ms = matches.filter(m => m.format === format && m.stage !== 'pool')
  if (!ms.length) return null
  const { boxes, width, height, R, L, topLB, hWB } = layout(ms, n)
  const byKey = new Map(boxes.map(b => [b.m.key, b]))
  const lines: string[] = []
  for (const b of boxes) {
    for (const src of [b.m.src_a, b.m.src_b]) {
      if (!src || src.type !== 'winner') continue
      const from = byKey.get(src.key)
      if (!from) continue
      // Only draw lines inside a section (WB→WB, LB→LB, WB final→GF, GF→GF2). LB final → GF crosses sections: label instead.
      if (from.m.stage === 'lb' && b.m.stage === 'gf') continue
      const x1 = from.x + W, y1 = from.y + BOX / 2, x2 = b.x, y2 = b.y + BOX / 2, xm = x1 + GAP / 2
      lines.push(`M${x1} ${y1} H${xm} V${y2} H${x2}`)
    }
  }
  const col = (c: number) => PAD + c * (W + GAP)
  const seedOf = (id: string | null) => teams.find(t => t.id === id)?.seed
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#150c22]" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="relative" style={{ width, height }}>
        <svg className="absolute inset-0" width={width} height={height} aria-hidden>
          {lines.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(196,181,253,0.45)" strokeWidth={2} />)}
        </svg>
        {Array.from({ length: R }, (_, i) => (
          <div key={'w' + i} className="absolute truncate text-[10px] font-black uppercase tracking-wider text-[#86efac]" style={{ left: col(i), top: 2, width: W }}>{roundLabel({ stage: 'wb', round: i + 1 }, n)}</div>
        ))}
        <div className="absolute truncate text-[10px] font-black uppercase tracking-wider text-[#ffb270]" style={{ left: col(R), top: 2, width: W }}>Grand final</div>
        <div className="absolute text-[10px] font-black uppercase tracking-wider text-white/40" style={{ left: col(R), top: LABEL + hWB / 2 + BOX / 2 + 4, width: W }}>↑ vs losers bracket winner</div>
        {Array.from({ length: L }, (_, i) => (
          <div key={'l' + i} className="absolute truncate text-[10px] font-black uppercase tracking-wider text-[#fca5a5]" style={{ left: col(i), top: topLB + 2, width: W }}>{roundLabel({ stage: 'lb', round: i + 1 }, n)}</div>
        ))}
        {boxes.map(({ m, x, y }) => {
          const live = m.team_a && m.team_b && !m.winner && !m.void
          const tappable = !!onTap && m.team_a && m.team_b
          return (
            <div key={m.key} onClick={() => (tappable ? onTap!(m) : undefined)}
              className={cx('absolute overflow-hidden rounded-lg border text-[11px] leading-tight', live ? 'border-[#ff8a2a] bg-[#2a1540] shadow-[0_0_14px_rgba(255,138,42,0.35)]' : 'border-white/15 bg-[#1e1230]', tappable && 'cursor-pointer active:scale-[0.98]', (m.team_a === me || m.team_b === me) && me && 'ring-2 ring-[#8b5cf6]')}
              style={{ left: x, top: y, width: W, height: BOX }}>
              <Row id={m.team_a} other={m.team_b} m={m} seed={seedOf(m.team_a)} teams={teams} />
              <div className="mx-1 border-t border-white/10" />
              <Row id={m.team_b} other={m.team_a} m={m} seed={seedOf(m.team_b)} teams={teams} />
              {live && m.net && <div className="absolute right-1 top-1 rounded bg-[#8b5cf6] px-1 text-[9px] font-black text-white">{m.net}</div>}
              {live && !m.net && <div className="absolute right-1 top-1 rounded bg-white/15 px-1 text-[9px] font-black text-white/70">queue</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Row({ id, other, m, seed, teams }: { id: string | null; other: string | null; m: Match; seed?: number | null; teams: Team[] }) {
  const won = m.winner && m.winner === id, lost = m.winner && m.winner !== id && id
  const bye = m.winner && m.sets.length === 0 && !other
  const isA = m.team_a === id
  const setsWon = m.sets.filter(([a, b]) => (isA ? a > b : b > a)).length
  const score = !m.sets.length ? (bye ? 'bye' : '') : m.sets.length === 1 ? (isA ? m.sets[0][0] : m.sets[0][1]) : setsWon
  return (
    <div className={cx('flex h-[28px] items-center gap-1 px-1.5', won && 'bg-[#22c55e]/15', lost && 'opacity-50')} title={m.sets.length ? setsSummary(m.sets, isA) : undefined}>
      {seed ? <span className="w-4 shrink-0 text-[9px] font-bold text-white/40">{seed}</span> : <span className="w-4 shrink-0" />}
      <span className={cx('min-w-0 flex-1 truncate', won ? 'font-black text-[#86efac]' : id ? 'font-semibold' : 'italic text-white/35')}>{id ? nameOf(teams, id) : (other && m.winner ? '—' : 'TBD')}</span>
      <span className={cx('shrink-0 font-mono text-[11px]', won ? 'text-[#86efac]' : 'text-white/60')}>{score}</span>
    </div>
  )
}
