import { useState } from 'react'
import { FORMAT_LABEL, POOL_LETTERS, poolNet, type Format } from './logic'
import { loadMe, phaseOf } from './store'
import { BracketList, FormatToggle, H, Msg, PoolTable, useBw } from './ui'

const PHASE_LABEL = { setup: 'Not started', pools: 'Pool play', preview: 'Pools done', playoffs: 'Playoffs' }

export default function Standings() {
  const { data, admin, t } = useBw()
  const me = loadMe(t)
  const myTeam = data.teams.find(x => x.id === me?.teamId)
  const [format, setFormat] = useState<Format>(myTeam?.format ?? 'men')
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
      {showBracket && <div><H sub={admin && phase === 'preview' ? 'Preview: players cannot see this until you publish.' : undefined}>Playoff bracket</H><BracketList matches={matches} teams={teams} format={format} me={myTeam?.id} /></div>}
      {pools.length > 0 && (
        <div>
          <H>Pools</H>
          <div className="space-y-3">
            {pools.map(p => (
              <div key={p}>
                <div className="mb-1 text-xs font-bold uppercase tracking-widest text-white/50">Net {poolNet(format, p)}</div>
                <PoolTable pool={p} teams={teams.filter(x => x.pool === p)} matches={matches.filter(m => m.pool === p)} me={myTeam?.id} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
