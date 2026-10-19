// Shared building blocks: context, buttons, cards, score sheet, pool table, bracket list.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  FORMAT_LABEL, bracketSize, champion, rankPool, roundLabel, rulesFor, setsSummary, winnerFromSets,
  type Format, type Match, type Team, type TKey,
} from './logic'
import type { Tournament } from './store'

export interface Ctx { t: TKey; base: string; data: Tournament; admin: boolean; setAdminState: (b: boolean) => void }
export const BwContext = createContext<Ctx>(null as unknown as Ctx)
export const useBw = () => useContext(BwContext)

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

export function Button({ children, onClick, to, kind = 'primary', disabled, className, busy }: {
  children: ReactNode; onClick?: () => void; to?: string; kind?: 'primary' | 'ghost' | 'green' | 'danger' | 'purple'; disabled?: boolean; className?: string; busy?: boolean
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-bold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 select-none'
  const kinds = {
    primary: 'bg-[#ff8a2a] text-[#1a0d05] shadow-[0_6px_0_#b85a0f] active:shadow-none active:translate-y-[3px]',
    purple: 'bg-[#8b5cf6] text-white shadow-[0_6px_0_#5b35b8] active:shadow-none active:translate-y-[3px]',
    green: 'bg-[#22c55e] text-[#04170b] shadow-[0_6px_0_#15803d] active:shadow-none active:translate-y-[3px]',
    danger: 'bg-[#ef4444] text-white shadow-[0_6px_0_#991b1b] active:shadow-none active:translate-y-[3px]',
    ghost: 'bg-white/5 text-[#f5efe6] border border-white/15 hover:bg-white/10',
  }
  const cls = cx(base, kinds[kind], className)
  if (to) return <Link to={to} className={cls}>{children}</Link>
  return <button type="button" className={cls} onClick={onClick} disabled={disabled || busy}>{busy ? <Spinner /> : null}{children}</button>
}

export function Spinner() { return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> }

export function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'win' | 'loss' | 'live' | 'purple' | 'orange' }) {
  const tones = {
    win: 'bg-[#14532d] border-[#22c55e]', loss: 'bg-[#5b1a1a] border-[#ef4444]', live: 'bg-[#2a1540] border-[#ff8a2a]',
    purple: 'bg-[#241538] border-[#8b5cf6]/50', orange: 'bg-[#2b1707] border-[#ff8a2a]/60',
  }
  return <div className={cx('rounded-2xl border p-4', tone ? tones[tone] : 'bg-[#1e1230] border-white/10', className)}>{children}</div>
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'orange' | 'purple' | 'green' | 'red' }) {
  const tones = { muted: 'bg-white/10 text-white/80', orange: 'bg-[#ff8a2a]/20 text-[#ffb270]', purple: 'bg-[#8b5cf6]/25 text-[#c4b5fd]', green: 'bg-[#22c55e]/20 text-[#86efac]', red: 'bg-[#ef4444]/20 text-[#fca5a5]' }
  return <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide', tones[tone])}>{children}</span>
}

export function H({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return <div className="mb-3"><h2 className="text-xl font-extrabold tracking-tight">{children}</h2>{sub && <p className="text-sm text-white/60">{sub}</p>}</div>
}

export function Msg({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' | 'ok' }) {
  const tones = { muted: 'bg-white/5 text-white/70', error: 'bg-[#ef4444]/15 text-[#fca5a5] border border-[#ef4444]/40', ok: 'bg-[#22c55e]/15 text-[#86efac]' }
  return <div className={cx('rounded-xl px-3 py-2 text-sm', tones[tone])}>{children}</div>
}

/** Per-format colors so it is always obvious which net you are looking at: men's = blue, women's = pink. */
export const FORMAT_COLOR: Record<Format, { fill: string; text: string; soft: string; ring: string; emoji: string }> = {
  men: { fill: '#2563eb', text: '#bfdbfe', soft: 'rgba(37,99,235,0.18)', ring: '#3b82f6', emoji: '' },
  women: { fill: '#db2777', text: '#fbcfe8', soft: 'rgba(219,39,119,0.18)', ring: '#ec4899', emoji: '' },
}

export function FormatToggle({ value, onChange, phases }: { value: Format; onChange: (f: Format) => void; phases?: Partial<Record<Format, string>> }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(['men', 'women'] as Format[]).map(f => {
          const c = FORMAT_COLOR[f], on = value === f
          return (
            <button key={f} type="button" onClick={() => onChange(f)} aria-pressed={on}
              className={cx('rounded-2xl border-2 px-3 py-3 text-sm font-black transition active:scale-[0.98]', on ? 'text-white shadow-lg' : 'text-white/60')}
              style={on ? { background: c.fill, borderColor: c.ring, boxShadow: `0 0 24px ${c.soft}, 0 6px 0 rgba(0,0,0,0.35)` } : { background: 'rgba(255,255,255,0.03)', borderColor: c.soft }}>
              {FORMAT_LABEL[f]}
              {phases?.[f] && <span className={cx('block text-[10px] font-bold uppercase tracking-wider', on ? 'text-white/90' : 'text-white/40')}>{phases[f]}</span>}
            </button>
          )
        })}
      </div>
      <div className="rounded-xl px-3 py-1.5 text-center text-xs font-black uppercase tracking-[0.25em]" style={{ background: FORMAT_COLOR[value].soft, color: FORMAT_COLOR[value].text }}>
        Viewing {FORMAT_LABEL[value]}
      </div>
    </div>
  )
}

/** The big "go here" sign: orange on black so it reads from across the gym. */
export function NetSign({ net, label, sub }: { net: string | null; label?: string; sub?: string }) {
  return (
    <div className="rounded-3xl border-4 border-[#ff8a2a] bg-[#07030c] px-4 py-5 text-center text-[#ff8a2a] shadow-[0_0_40px_rgba(255,138,42,0.35)]">
      <div className="text-xs font-black uppercase tracking-[0.3em] text-[#ffb270]">{label ?? 'Go to net'}</div>
      <div className="mt-1 text-7xl font-black leading-none drop-shadow-[0_0_18px_rgba(255,138,42,0.7)]">{net ?? '—'}</div>
      {sub && <div className="mt-2 text-sm font-bold uppercase tracking-widest text-[#ffb270]/80">{sub}</div>}
    </div>
  )
}

export const teamById = (teams: Team[], id: string | null | undefined) => teams.find(t => t.id === id) ?? null
export const nameOf = (teams: Team[], id: string | null | undefined, fallback = 'TBD') => teamById(teams, id)?.name ?? fallback

// ---------------------------------------------------------------- score sheet

export function ScoreSheet({ match, teams, onClose, onSave, onClear, canClear }: {
  match: Match; teams: Team[]; onClose: () => void; onSave: (sets: [number, number][]) => Promise<void>; onClear?: () => Promise<void>; canClear?: boolean
}) {
  const rules = rulesFor(match)
  const rows = rules.bestOf
  const init = Array.from({ length: rows }, (_, i) => match.sets[i] ? [String(match.sets[i][0]), String(match.sets[i][1])] : ['', ''])
  const [vals, setVals] = useState<string[][]>(init)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const a = nameOf(teams, match.team_a), b = nameOf(teams, match.team_b)
  const sets = vals.filter(([x, y]) => x !== '' || y !== '').map(([x, y]) => [Number(x), Number(y)] as [number, number])
  const side = winnerFromSets(sets, rules)
  const submit = async () => {
    setErr(null)
    if (!side) { setErr(rules.bestOf === 1 ? 'Enter both scores; they cannot be tied.' : 'Enter sets until one team has won two.'); return }
    for (const [x, y] of sets) {
      const hi = Math.max(x, y), lo = Math.min(x, y)
      if (hi < rules.target && rules.bestOf === 1 && rules.target === 30) { /* no cap, but must reach 30 */ }
      if (hi < rules.target) { setErr(`A set is won at ${rules.target}${rules.winBy2 ? ' (win by 2)' : ''}. Double-check ${x}-${y}.`); return }
      if (rules.winBy2 && hi - lo < 2) { setErr(`Win by 2 needed: ${x}-${y} isn't finished.`); return }
    }
    setBusy(true)
    try { await onSave(sets); onClose() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1e1230] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[#ffb270]">{roundLabelFor(match, teams)}</div>
        <div className="text-lg font-extrabold">{a} <span className="text-white/40">vs</span> {b}</div>
        <div className="mb-4 text-sm text-white/60">{rules.label}</div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="truncate text-center text-sm font-bold">{a}</div><div /><div className="truncate text-center text-sm font-bold">{b}</div>
          {vals.map((row, i) => (
            <RowInputs key={i} row={row} label={rows > 1 ? `Set ${i + 1}${i === 2 ? ' (if needed)' : ''}` : 'Score'}
              onChange={r => setVals(v => v.map((x, j) => (j === i ? r : x)))} />
          ))}
        </div>
        {side && <div className="mt-3 text-center text-sm font-bold text-[#86efac]">Winner: {side === 'a' ? a : b}</div>}
        {err && <div className="mt-3"><Msg tone="error">{err}</Msg></div>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button kind="green" onClick={submit} busy={busy}>Save score</Button>
        </div>
        {canClear && onClear && match.winner && (
          <button type="button" className="mt-3 w-full text-center text-sm text-[#fca5a5] underline" onClick={async () => { setBusy(true); try { await onClear(); onClose() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }}>
            Clear this result
          </button>
        )}
      </div>
    </div>
  )
}

function RowInputs({ row, label, onChange }: { row: string[]; label: string; onChange: (r: string[]) => void }) {
  const inp = 'w-full rounded-xl border border-white/15 bg-[#120a1c] px-2 py-3 text-center text-3xl font-black text-white outline-none focus:border-[#ff8a2a]'
  return (
    <>
      <input className={inp} type="number" inputMode="numeric" pattern="[0-9]*" min={0} value={row[0]} onChange={e => onChange([e.target.value, row[1]])} />
      <div className="px-1 text-center text-[10px] font-bold uppercase leading-tight text-white/50">{label}</div>
      <input className={inp} type="number" inputMode="numeric" pattern="[0-9]*" min={0} value={row[1]} onChange={e => onChange([row[0], e.target.value])} />
    </>
  )
}

export function roundLabelFor(m: Match, teams: Team[]): string {
  if (m.stage === 'pool') return `Pool ${m.pool}`
  const n = teams.filter(t => t.format === m.format && t.seed).length || teams.filter(t => t.format === m.format).length
  return roundLabel(m, n)
}

// ---------------------------------------------------------------- match row

export function MatchRow({ m, teams, me, onTap, showNet = true }: { m: Match; teams: Team[]; me?: string | null; onTap?: (m: Match) => void; showNet?: boolean }) {
  const a = nameOf(teams, m.team_a, 'TBD'), b = nameOf(teams, m.team_b, 'TBD')
  const mine = me && (m.team_a === me || m.team_b === me)
  const won = mine && m.winner === me, lost = mine && m.winner && m.winner !== me
  const tone = won ? 'win' : lost ? 'loss' : undefined
  const perspectiveA = !me || m.team_a === me
  const opp = mine ? (m.team_a === me ? b : a) : null
  const body = (
    <Card tone={tone} className={cx('flex items-center gap-3', onTap && 'cursor-pointer active:scale-[0.99]')}>
      <div className="min-w-0 flex-1">
        {mine ? (
          <div className="truncate text-base font-extrabold">{opp}</div>
        ) : (
          <div className="truncate text-base font-bold">{a} <span className="text-white/40">vs</span> {b}</div>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/60">
          {m.stage !== 'pool' && <span>{roundLabelFor(m, teams)}</span>}
          {m.void ? <Pill>No match needed</Pill>
            : m.winner && m.sets.length === 0 ? <Pill>Bye</Pill>
            : m.winner ? <span className="font-mono text-sm text-white/90">{setsSummary(m.sets, perspectiveA)}</span>
            : (!m.team_a || !m.team_b) ? <Pill tone="muted">Waiting</Pill>
            : <Pill tone="orange">{onTap ? 'Tap to enter score' : 'In progress'}</Pill>}
          {showNet && m.net && !m.winner && <Pill tone="purple">Net {m.net}</Pill>}
        </div>
      </div>
      {won && <div className="text-2xl font-black text-[#86efac]">W</div>}
      {lost && <div className="text-2xl font-black text-[#fca5a5]">L</div>}
    </Card>
  )
  return onTap ? <div onClick={() => onTap(m)}>{body}</div> : body
}

// ---------------------------------------------------------------- pool table & bracket

export function PoolTable({ pool, teams, matches, me }: { pool: string; teams: Team[]; matches: Match[]; me?: string | null }) {
  const lines = rankPool(teams, matches)
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="bg-white/5 text-left text-[11px] uppercase tracking-wider text-white/50">
          <th className="px-3 py-2">Pool {pool}</th><th className="px-2 py-2 text-center">W-L</th><th className="px-2 py-2 text-center">+/-</th><th className="px-3 py-2 text-center">Pts</th>
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.team.id} className={cx('border-t border-white/5', l.team.id === me && 'bg-[#8b5cf6]/20')}>
              <td className="px-3 py-2 font-bold"><span className="mr-2 text-white/40">{i + 1}</span>{l.team.name}</td>
              <td className="px-2 py-2 text-center font-mono">{l.wins}-{l.losses}</td>
              <td className={cx('px-2 py-2 text-center font-mono', l.diff > 0 ? 'text-[#86efac]' : l.diff < 0 ? 'text-[#fca5a5]' : '')}>{l.diff > 0 ? '+' : ''}{l.diff}</td>
              <td className="px-3 py-2 text-center font-mono text-white/70">{l.pf}-{l.pa}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export function BracketList({ matches, teams, format, me, onTap }: { matches: Match[]; teams: Team[]; format: Format; me?: string | null; onTap?: (m: Match) => void }) {
  const n = teams.filter(t => t.format === format).length
  const po = matches.filter(m => m.format === format && m.stage !== 'pool')
  const champ = champion(matches, format)
  const groups: { label: string; items: Match[] }[] = []
  const order = (m: Match) => (m.stage === 'wb' ? 0 : m.stage === 'lb' ? 100 : m.stage === 'gf' ? 200 : 201) + m.round
  for (const m of [...po].sort((x, y) => order(x) - order(y) || x.slot - y.slot)) {
    const label = roundLabel(m, n)
    const g = groups[groups.length - 1]
    if (g && g.label === label) g.items.push(m); else groups.push({ label, items: [m] })
  }
  if (!po.length) return <Msg>No bracket yet.</Msg>
  return (
    <div className="space-y-5">
      {champ && <Card tone="orange" className="text-center"><div className="text-xs font-black uppercase tracking-[0.3em]">Champions</div><div className="text-2xl font-black">🏆 {nameOf(teams, champ)}</div></Card>}
      {groups.map(g => (
        <div key={g.label}>
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-[#c4b5fd]">{g.label} <span className="text-white/30">· {bracketSize(n) > n ? 'byes auto-advance' : ''}</span></div>
          <div className="space-y-2">{g.items.filter(m => !(m.stage === 'gf2' && m.void)).map(m => <MatchRow key={m.id} m={m} teams={teams} me={me} onTap={onTap} />)}</div>
        </div>
      ))}
    </div>
  )
}
