import { useRef, useState, type ReactNode } from 'react'
import {
  FORMAT_LABEL, POOL_LETTERS, champion, netsFor, parseTeamsCsv, poolNet, poolsComplete, type Format, type Match, type ParsedTeam,
} from './logic'
import { ADMIN_PASSWORD, FORMATS, phaseOf } from './store'
import { BracketList, Button, Card, FormatToggle, H, MatchRow, Msg, Pill, ScoreSheet, cx, nameOf, useBw } from './ui'
import { BracketDiagram } from './Bracket'

type Tab = 'teams' | 'games' | 'playoffs' | 'danger' | 'sim'
const PHASE_LABEL = { setup: 'Setup', pools: 'Pool play', preview: 'Bracket preview', playoffs: 'Playoffs live' }

export default function Admin() {
  const { admin, setAdminState, t } = useBw()
  const [pw, setPw] = useState('')
  const [bad, setBad] = useState(false)
  if (!admin) {
    return (
      <div className="space-y-3 pt-6">
        <H sub="Enter the admin password to manage the tournament.">Admin</H>
        <input type="password" value={pw} onChange={e => { setPw(e.target.value); setBad(false) }} placeholder="Password" autoComplete="current-password"
          onKeyDown={e => { if (e.key === 'Enter') { if (pw === ADMIN_PASSWORD) setAdminState(true); else setBad(true) } }}
          className="w-full rounded-2xl border border-white/15 bg-[#1e1230] px-4 py-3 text-base text-white outline-none focus:border-[#ff8a2a]" />
        {bad && <Msg tone="error">Nope, that's not it.</Msg>}
        {t === 'test' && <Msg>Test mode hint: the password is "{ADMIN_PASSWORD}".</Msg>}
        <Button className="w-full" onClick={() => { if (pw === ADMIN_PASSWORD) setAdminState(true); else setBad(true) }}>Unlock</Button>
      </div>
    )
  }
  return <AdminPanel />
}

function useRun() {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const run = async (label: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(label); setErr(null); setOk(null)
    try { await fn(); if (done) setOk(done) } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }
  return { busy, err, ok, run, setErr }
}

function AdminPanel() {
  const { data, t, setAdminState } = useBw()
  const [tab, setTab] = useState<Tab>(t === 'test' ? 'sim' : 'teams')
  const [format, setFormat] = useState<Format>('men')
  const tabs: { id: Tab; label: string }[] = [
    ...(t === 'test' ? [{ id: 'sim' as Tab, label: 'Simulate' }] : []),
    { id: 'teams', label: 'Teams' }, { id: 'games', label: 'Pools' }, { id: 'playoffs', label: 'Playoffs' }, { id: 'danger', label: 'Reset' },
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><H>Admin</H><button type="button" className="text-xs text-white/50 underline" onClick={() => setAdminState(false)}>Lock</button></div>
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/5 p-1">
        {tabs.map(x => <button key={x.id} type="button" onClick={() => setTab(x.id)} className={cx('whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold', tab === x.id ? 'bg-[#ff8a2a] text-[#1a0d05]' : 'text-white/70')}>{x.label}</button>)}
      </div>
      {tab !== 'danger' && tab !== 'sim' && <FormatToggle value={format} onChange={setFormat} phases={{ men: PHASE_LABEL[phaseOf(data.states, 'men')], women: PHASE_LABEL[phaseOf(data.states, 'women')] }} />}
      {tab === 'sim' && <SimTab />}
      {tab === 'teams' && <TeamsTab format={format} />}
      {tab === 'games' && <GamesTab format={format} />}
      {tab === 'playoffs' && <PlayoffsTab format={format} />}
      {tab === 'danger' && <DangerTab />}
    </div>
  )
}

// ---------------------------------------------------------------- teams

const TEMPLATE = 'Player 1,Player 2,Format\nAnn Lee,Bo Kim,Men\nCy Ng,Di Wu,Women\n'

function TeamsTab({ format }: { format: Format }) {
  const { data } = useBw()
  const { busy, err, ok, run } = useRun()
  const [text, setText] = useState('')
  const [p1, setP1] = useState(''); const [p2, setP2] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const parsed = parseTeamsCsv(text)
  const phase = phaseOf(data.states, format)
  const teams = data.teams.filter(x => x.format === format)
  const locked = phase !== 'setup'
  const onFile = (f: File | undefined) => { if (!f) return; const r = new FileReader(); r.onload = () => setText(String(r.result || '')); r.readAsText(f) }
  return (
    <div className="space-y-4">
      <Card>
        <H sub="One team per line: Player 1, Player 2, Men or Women. Paste from a spreadsheet or pick a CSV file.">Upload teams</H>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder={'Ann Lee, Bo Kim, Men\nCy Ng, Di Wu, Women'}
          className="w-full rounded-xl border border-white/15 bg-[#120a1c] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[#ff8a2a]" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button kind="ghost" onClick={() => fileRef.current?.click()}>Choose CSV</Button>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          <a className="text-sm text-[#c4b5fd] underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="balloween-teams.csv">Download template</a>
        </div>
        {text && (
          <div className="mt-3 space-y-2">
            {parsed.errors.map((e, i) => <Msg key={i} tone="error">{e}</Msg>)}
            <Msg>{parsed.teams.length} teams ready: {parsed.teams.filter(x => x.format === 'men').length} men's, {parsed.teams.filter(x => x.format === 'women').length} women's.</Msg>
            <Button kind="green" className="w-full" busy={busy === 'add'} disabled={!parsed.teams.length}
              onClick={() => run('add', () => data.actions.addTeams(parsed.teams).then(() => setText('')), `Added ${parsed.teams.length} teams.`)}>Add these teams</Button>
          </div>
        )}
      </Card>
      <Card>
        <H sub={`Quick add to the ${FORMAT_LABEL[format]}.`}>Add one team</H>
        <div className="grid grid-cols-2 gap-2">
          <input value={p1} onChange={e => setP1(e.target.value)} placeholder="Player 1" className="rounded-xl border border-white/15 bg-[#120a1c] px-3 py-2 text-white outline-none focus:border-[#ff8a2a]" />
          <input value={p2} onChange={e => setP2(e.target.value)} placeholder="Player 2" className="rounded-xl border border-white/15 bg-[#120a1c] px-3 py-2 text-white outline-none focus:border-[#ff8a2a]" />
        </div>
        <Button kind="ghost" className="mt-2 w-full" disabled={!p1.trim() || !p2.trim()} busy={busy === 'one'}
          onClick={() => run('one', () => data.actions.addTeams([{ player1: p1, player2: p2, format } as ParsedTeam]).then(() => { setP1(''); setP2('') }), 'Team added.')}>Add team</Button>
      </Card>
      {err && <Msg tone="error">{err}</Msg>}{ok && <Msg tone="ok">{ok}</Msg>}
      <div>
        <H sub={locked ? 'Pools are drawn, so teams are locked. Use Reset → Restart to change the field.' : `${teams.length} teams. 12 or 16 is ideal; other counts get pools of 3 and 4 plus byes.`}>{FORMAT_LABEL[format]} · {teams.length} teams</H>
        <div className="space-y-2">
          {teams.map(x => (
            <Card key={x.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><div className="truncate font-bold">{x.name}</div><div className="truncate text-xs text-white/50">{x.player1} &amp; {x.player2}{x.pool ? ` · Pool ${x.pool}` : ''}</div></div>
              {!locked && <button type="button" className="shrink-0 text-xs text-[#fca5a5] underline" onClick={() => run('rm' + x.id, () => data.actions.removeTeam(x.id))}>Remove</button>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- pools & scores

function GamesTab({ format }: { format: Format }) {
  const { data } = useBw()
  const { busy, err, ok, run } = useRun()
  const [open, setOpen] = useState<Match | null>(null)
  const [confirm, setConfirm] = useState(false)
  const phase = phaseOf(data.states, format)
  const teams = data.teams.filter(x => x.format === format)
  const matches = data.matches.filter(m => m.format === format && m.stage === 'pool')
  const pools = POOL_LETTERS.filter(p => teams.some(x => x.pool === p))
  const done = matches.filter(m => m.winner).length
  const scored = done > 0
  return (
    <div className="space-y-4">
      {phase === 'setup' ? (
        <Card>
          <H sub={`${teams.length} teams will be shuffled into ${teams.length >= 12 ? 4 : teams.length >= 9 ? 3 : 2} pools, one net each.`}>Draw pools</H>
          <Button kind="green" className="w-full" disabled={teams.length < 3} busy={busy === 'gen'} onClick={() => run('gen', () => data.actions.generatePools(format), 'Pools drawn. Players can now see their net.')}>Generate pools</Button>
        </Card>
      ) : (
        <Card className="flex items-center justify-between gap-3">
          <div><div className="font-bold">{done} / {matches.length} pool games scored</div><div className="text-xs text-white/50">Tap any game to enter or fix a score.</div></div>
          {phase === 'pools' && (confirm
            ? <div className="flex flex-col gap-1"><Button kind="danger" className="px-3 py-2 text-xs" busy={busy === 'gen'} onClick={() => run('gen', () => data.actions.generatePools(format).then(() => setConfirm(false)), 'Pools redrawn.')}>Yes, redraw{scored ? ' (loses scores)' : ''}</Button><button type="button" className="text-xs underline" onClick={() => setConfirm(false)}>Cancel</button></div>
            : <Button kind="ghost" className="px-3 py-2 text-xs" onClick={() => setConfirm(true)}>Redraw pools</Button>)}
        </Card>
      )}
      {err && <Msg tone="error">{err}</Msg>}{ok && <Msg tone="ok">{ok}</Msg>}
      {pools.map(p => (
        <div key={p}>
          <div className="mb-2 flex items-center gap-2"><span className="text-sm font-black uppercase tracking-widest">Pool {p}</span><Pill tone="purple">Net {poolNet(format, p)}</Pill><span className="text-xs text-white/50">{teams.filter(x => x.pool === p).map(x => x.name).join(' · ')}</span></div>
          <div className="space-y-2">{matches.filter(m => m.pool === p).map(m => <MatchRow key={m.id} m={m} teams={teams} onTap={setOpen} showNet={false} />)}</div>
        </div>
      ))}
      {open && <ScoreSheet match={open} teams={teams} onClose={() => setOpen(null)} onSave={s => data.actions.saveScore(open, s)} onClear={() => data.actions.clearScore(open)} canClear />}
    </div>
  )
}

// ---------------------------------------------------------------- playoffs

function PlayoffsTab({ format }: { format: Format }) {
  const { data } = useBw()
  const { busy, err, ok, run } = useRun()
  const [open, setOpen] = useState<Match | null>(null)
  const [view, setView] = useState<'diagram' | 'list'>('diagram')
  const phase = phaseOf(data.states, format)
  const teams = data.teams.filter(x => x.format === format)
  const matches = data.matches.filter(m => m.format === format)
  const ready = poolsComplete(matches, format)
  const live = matches.filter(m => m.stage !== 'pool' && m.team_a && m.team_b && !m.winner && !m.void)
  const champ = champion(matches, format)
  const nets = netsFor(format)
  return (
    <div className="space-y-4">
      {phase === 'setup' && <Msg>Draw pools first.</Msg>}
      {phase === 'pools' && (
        <Card>
          <H sub={ready ? 'Every pool game has a score. Starting builds the bracket for you to review; players will not see it until you publish.' : `Waiting on ${matches.filter(m => m.stage === 'pool' && !m.winner).length} pool games.`}>Start playoffs</H>
          <Button kind={ready ? 'green' : 'ghost'} className="w-full" disabled={!ready} busy={busy === 'start'} onClick={() => run('start', () => data.actions.startPlayoffs(format), 'Bracket generated. Review it, then publish.')}>Start playoffs</Button>
        </Card>
      )}
      {phase === 'preview' && (
        <Card tone="purple">
          <H sub="Only admins can see this bracket. Fix pool scores and regenerate if something looks off, then publish it to everyone.">Bracket preview</H>
          <div className="grid grid-cols-2 gap-2">
            <Button kind="ghost" busy={busy === 'regen'} onClick={() => run('regen', () => data.actions.startPlayoffs(format), 'Bracket regenerated from current pool results.')}>Regenerate</Button>
            <Button kind="green" busy={busy === 'pub'} onClick={() => run('pub', () => data.actions.publishPlayoffs(format), 'Published! Players now see their playoff games.')}>Publish playoffs</Button>
          </div>
        </Card>
      )}
      {phase === 'playoffs' && !champ && (
        <Card className="flex items-center justify-between gap-2">
          <div><div className="font-bold">Playoffs are live</div><div className="text-xs text-white/50">{live.length} games in progress or waiting for a net.</div></div>
          <Button kind="ghost" className="px-3 py-2 text-xs" busy={busy === 'recheck'} onClick={() => run('recheck', () => data.actions.recheck(format), 'Bracket rechecked.')}>Recheck</Button>
        </Card>
      )}
      {err && <Msg tone="error">{err}</Msg>}{ok && <Msg tone="ok">{ok}</Msg>}
      {(phase === 'preview' || phase === 'playoffs') && live.length > 0 && (
        <div>
          <H sub="Change a net if you need to shuffle courts.">On the nets</H>
          <div className="space-y-2">
            {live.map(m => (
              <Card key={m.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1 truncate text-sm font-bold">{nameOf(teams, m.team_a)} vs {nameOf(teams, m.team_b)}</div>
                <select value={m.net ?? ''} onChange={e => run('net' + m.id, () => data.actions.setNet(m, e.target.value || null))}
                  className="rounded-lg border border-white/15 bg-[#120a1c] px-2 py-1 text-sm text-white">
                  <option value="">No net</option>{nets.map(n => <option key={n} value={n}>Net {n}</option>)}
                </select>
              </Card>
            ))}
          </div>
        </div>
      )}
      {(phase === 'preview' || phase === 'playoffs') && (
        <div>
          <div className="mb-2 flex items-center justify-between"><H sub="Tap a game to enter or fix a result. Fixing an earlier result reopens everything after it.">Bracket</H>
            <Button kind="ghost" className="px-3 py-1.5 text-xs" onClick={() => setView(v => (v === 'diagram' ? 'list' : 'diagram'))}>{view === 'diagram' ? 'List view' : 'Bracket view'}</Button></div>
          {view === 'diagram'
            ? <BracketDiagram matches={matches} teams={teams} format={format} onTap={m => setOpen(m)} />
            : <BracketList matches={matches} teams={teams} format={format} onTap={m => (m.team_a && m.team_b ? setOpen(m) : undefined)} />}
        </div>
      )}
      {open && <ScoreSheet match={open} teams={teams} onClose={() => setOpen(null)} onSave={s => data.actions.saveScore(open, s)} onClear={() => data.actions.clearScore(open)} canClear />}
    </div>
  )
}

// ---------------------------------------------------------------- danger

function DangerTab() {
  const { data } = useBw()
  const { busy, err, ok, run } = useRun()
  const [arm, setArm] = useState<'restart' | 'clear' | null>(null)
  const Row = ({ id, title, sub, label, children }: { id: 'restart' | 'clear'; title: string; sub: string; label: string; children?: ReactNode }) => (
    <Card>
      <div className="font-extrabold">{title}</div><div className="mb-3 text-sm text-white/60">{sub}</div>
      {arm === id ? (
        <div className="space-y-2"><Msg tone="error">Are you sure? This cannot be undone.</Msg><div className="grid grid-cols-2 gap-2"><Button kind="ghost" onClick={() => setArm(null)}>Cancel</Button>{children}</div></div>
      ) : <Button kind="danger" className="w-full" onClick={() => setArm(id)}>{label}</Button>}
    </Card>
  )
  return (
    <div className="space-y-4">
      <Row id="restart" title="Restart the tournament" sub="Deletes every score, pool and bracket for both formats. Keeps the uploaded teams." label="Restart tournament">
        <Button kind="danger" busy={busy === 'restart'} onClick={() => run('restart', () => data.actions.restart().then(() => setArm(null)), 'Tournament restarted. Teams kept.')}>Yes, restart</Button>
      </Row>
      <Row id="clear" title="Clear everything" sub="Deletes scores, brackets AND all teams. Back to a blank slate." label="Clear everything">
        <Button kind="danger" busy={busy === 'clear'} onClick={() => run('clear', () => data.actions.clearAll().then(() => setArm(null)), 'Everything cleared.')}>Yes, clear all</Button>
      </Row>
      {err && <Msg tone="error">{err}</Msg>}{ok && <Msg tone="ok">{ok}</Msg>}
    </div>
  )
}

// ---------------------------------------------------------------- simulation (test mode)

function SimTab() {
  const { data } = useBw()
  const { busy, err, ok, run } = useRun()
  const [log, setLog] = useState<string[]>([])
  const note = (s: string) => setLog(l => [`${new Date().toLocaleTimeString()} ${s}`, ...l].slice(0, 12))
  const each = async (fn: (f: Format) => Promise<unknown>) => { for (const f of FORMATS) await fn(f) }
  const a = data.actions
  const status = FORMATS.map(f => `${FORMAT_LABEL[f]}: ${PHASE_LABEL[phaseOf(data.states, f)]}${champion(data.matches, f) ? ' · champion decided' : ''}`).join(' · ')
  const B = ({ id, label, kind = 'ghost', fn }: { id: string; label: string; kind?: 'ghost' | 'green' | 'primary' | 'purple' | 'danger'; fn: () => Promise<unknown> }) => (
    <Button kind={kind} className="w-full" busy={busy === id} disabled={!!busy && busy !== id} onClick={() => run(id, async () => { await fn(); note(label) })}>{label}</Button>
  )
  return (
    <div className="space-y-4">
      <Msg>{status}</Msg>
      <Card>
        <H sub="Walk a fake tournament through every stage. Open /Balloween/Test on another phone as a player to watch it update.">Simulation</H>
        <div className="space-y-2">
          <B id="sample" kind="primary" label="1. Load sample teams (12 men, 16 women)" fn={() => a.loadSample()} />
          <B id="pools" label="2. Draw pools (both formats)" fn={() => each(f => a.generatePools(f))} />
          <B id="round" label="3. Play one game per net" fn={() => each(f => a.playRound(f))} />
          <B id="finishpools" label="3b. Finish all pool games" fn={() => each(f => a.finishPools(f))} />
          <B id="start" label="4. Start playoffs (preview)" fn={() => each(f => a.startPlayoffs(f))} />
          <B id="publish" kind="green" label="5. Publish playoffs" fn={() => each(f => a.publishPlayoffs(f))} />
          <B id="pround" label="6. Play one playoff round" fn={() => each(f => a.playRound(f))} />
          <B id="finish" label="6b. Finish playoffs" fn={() => each(f => a.finishPlayoffs(f))} />
          <B id="reset" kind="danger" label="Reset test data" fn={() => a.clearAll()} />
        </div>
      </Card>
      {err && <Msg tone="error">{err}</Msg>}{ok && <Msg tone="ok">{ok}</Msg>}
      {log.length > 0 && <Card><div className="mb-1 text-xs font-bold uppercase tracking-widest text-white/50">Log</div>{log.map((l, i) => <div key={i} className="text-xs text-white/70">{l}</div>)}</Card>}
    </div>
  )
}
