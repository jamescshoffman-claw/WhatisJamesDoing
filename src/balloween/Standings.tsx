import { useState } from 'react'
import { FORMAT_LABEL, POOL_LETTERS, poolNet, type Format, type Match } from './logic'
import { loadMe, phaseOf } from './store'
import { BracketList, Button, FormatToggle, H, Msg, PoolTable, ScoreSheet, useBw } from './ui'
import { BracketDiagram } from './Bracket'

const PHASE_LABEL = { setup: 'Not started', pools: 'Pool play', preview: 'Pools done', playoffs: 'Playoffs' }

export default function Standings() {
  const { data, admin, t } = useBw()
  const me = loadMe(t)
  const myTeam = data.teams.find(x => x.id === me?.teamId)
  const [format, setFormat] = useState<Format>(myTeam?.format ?? 'men')
  const [view, setView] = useState<'diagram' | 'list'>('diagram')
  const [open, setOpen] = useState<Match | null>(null)
  // Admins can tap any game with both teams in it to enter or fix its score.
  const onTap = admin ? (m: Match) => { if (m.team_a && m.team_b) setOpen(m) } : undefined
  const phase = phaseOf(data.states, format)
  const teams = data.teams.filter(x => x.format === format)
  const matches = data.matches.filter(m => m.format === format)
  const pools = POOL_LETTERS.filter(p => teams.some(x => x.pool === p))
  const showBracket = phase === 'playoffs' || (admin && phase === 'preview')
  return (
    <div className="space-y-4">
      <H>Standings</H>
      <FormatToggle value={format} onChange={setFormat} phases={{ men: PHASE_LABEL[phaseOf(data.states, 'men')], women: PHASE_LABEL[phaseOf(data.states, 'women')] }} />
      {phase === 'setup' && <Msg>{teams.length ? `${teams.length} teams registered for the ${FORMAT_LABEL[format]}. Pools haven't been drawn yet.` : `No teams in the ${FORMAT_LABEL[format]} yet.`}</Msg>}
      {showBracket && (
        <div>
          <div className="mb-2 flex items-center justify-between"><H sub={admin && phase === 'preview' ? 'Preview: players cannot see this until you publish.' : admin ? 'Tap a game to enter or change its score.' : 'Swipe sideways to see every round.'}>Playoff bracket</H>
            <Button kind="ghost" className="px-3 py-1.5 text-xs" onClick={() => setView(v => (v === 'diagram' ? 'list' : 'diagram'))}>{view === 'diagram' ? 'List view' : 'Bracket view'}</Button></div>
          {view === 'diagram' ? <BracketDiagram matches={matches} teams={teams} format={format} me={myTeam?.id} onTap={onTap} /> : <BracketList matches={matches} teams={teams} format={format} me={myTeam?.id} onTap={onTap} />}
        </div>
      )}
      {pools.length > 0 && (
        <div>
          <H>Pools</H>
          <div className="space-y-3">
            {pools.map(p => (
              <div key={p}>
                <PoolTable pool={p} teams={teams.filter(x => x.pool === p)} matches={matches.filter(m => m.pool === p)} me={myTeam?.id} />
              </div>
            ))}
          </div>
        </div>
      )}
      {open && <ScoreSheet match={open} teams={data.teams} onClose={() => setOpen(null)} onSave={sets => data.actions.saveScore(open, sets)} onClear={() => data.actions.clearScore(open)} canClear />}
    </div>
  )
}
