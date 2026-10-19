import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  FORMAT_LABEL, champion, currentPlayoffMatch, describeSrc, poolNet, rulesFor, teamLosses, type Match,
} from './logic'
import { loadMe, phaseOf, saveMe } from './store'
import { Button, Card, FORMAT_COLOR, H, MatchRow, Msg, NetSign, Pill, PoolTable, ScoreSheet, nameOf, roundLabelFor, useBw } from './ui'
import { BracketDiagram } from './Bracket'

export default function TeamView() {
  const { base, t, data } = useBw()
  const me = loadMe(t)
  const [open, setOpen] = useState<Match | null>(null)
  const [, force] = useState(0)
  if (!me) return <Navigate to={`${base}/player`} replace />
  const team = data.teams.find(x => x.id === me.teamId)
  if (data.loading && !team) return <p className="text-center text-white/50">Loading…</p>
  if (!team) return <div className="space-y-3"><Msg tone="error">Your team is no longer in the tournament.</Msg><Button to={`${base}/player`} kind="ghost" onClick={() => saveMe(t, null)}>Pick a name</Button></div>
  const phase = phaseOf(data.states, team.format)
  const fmtMatches = data.matches.filter(m => m.format === team.format)
  const poolTeams = data.teams.filter(x => x.format === team.format && x.pool === team.pool)
  const poolMatches = fmtMatches.filter(m => m.stage === 'pool' && m.pool === team.pool)
  const myPool = poolMatches.filter(m => m.team_a === team.id || m.team_b === team.id)
  const myPlayoff = fmtMatches.filter(m => m.stage !== 'pool' && !m.void && (m.team_a === team.id || m.team_b === team.id) && (m.team_a && m.team_b))
  const notYou = () => { saveMe(t, null); force(x => x + 1) }

  const header = (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="mb-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white" style={{ background: FORMAT_COLOR[team.format].fill }}>{FORMAT_COLOR[team.format].emoji} {FORMAT_LABEL[team.format]}{team.pool ? ` · Pool ${team.pool}` : ''}{team.seed ? ` · Seed ${team.seed}` : ''}</div>
        <div className="text-2xl font-black leading-tight">{team.name}</div>
        <div className="text-sm text-white/60">{team.player1} &amp; {team.player2}</div>
      </div>
      <Link to={`${base}/player`} onClick={notYou} className="shrink-0 text-xs text-white/50 underline">Not you?</Link>
    </div>
  )

  let body
  if (phase === 'setup') {
    body = <Card tone="purple"><div className="text-lg font-extrabold">You're in! 🎃</div><p className="text-white/70">Pools haven't been drawn yet. Check back soon and this page will tell you which net to go to.</p></Card>
  } else if (phase === 'pools' || phase === 'preview') {
    const left = myPool.filter(m => !m.winner).length
    body = (
      <div className="space-y-4">
        <NetSign net={team.pool ? poolNet(team.format, team.pool) : null} label={`${FORMAT_LABEL[team.format]} · go to net`} />
        {phase === 'preview' && <Msg tone="ok">Pool play is done. The playoff bracket is being set up, hang tight.</Msg>}
        {left === 0 && phase === 'pools' && <Msg tone="ok">All your pool games are in. Wait for the playoff bracket.</Msg>}
        <div>
          <H sub={left ? `Play these ${left} ${left === 1 ? 'game' : 'games'} in any order, one set to 21 (win by 2). Tap a game to enter the score.` : undefined}>Your pool games</H>
          <div className="space-y-2">{myPool.map(m => <MatchRow key={m.id} m={m} teams={data.teams} me={team.id} onTap={setOpen} showNet={false} />)}</div>
        </div>
        <div><H>Pool {team.pool}</H><PoolTable pool={team.pool!} teams={poolTeams} matches={poolMatches} me={team.id} /></div>
      </div>
    )
  } else {
    const champ = champion(data.matches, team.format)
    const cur = currentPlayoffMatch(team.id, data.matches)
    const losses = teamLosses(team.id, data.matches)
    let top
    if (champ === team.id) top = <Card tone="orange" className="text-center"><div className="text-5xl">🏆</div><div className="text-2xl font-black">Champions!</div><div className="text-sm">You won the {FORMAT_LABEL[team.format]} bracket.</div></Card>
    else if (champ || (!cur && losses >= 2)) {
      const lastLoss = [...myPlayoff].reverse().find(m => m.winner && m.winner !== team.id)
      top = <Card tone="loss"><div className="text-lg font-extrabold">You're out of the bracket</div><div className="text-sm text-white/80">{losses >= 2 ? 'Two losses in the playoffs.' : 'The bracket is finished.'}{lastLoss ? ` Last game: ${roundLabelFor(lastLoss, data.teams)}.` : ''} Thanks for playing! 🎃</div></Card>
    } else if (!cur) top = <Card tone="purple"><div className="text-lg font-extrabold">Waiting on the bracket</div><div className="text-sm text-white/70">Your next game will show up here.</div></Card>
    else if (cur.team_a && cur.team_b) {
      const opp = nameOf(data.teams, cur.team_a === team.id ? cur.team_b : cur.team_a)
      top = (
        <div className="space-y-3">
          {cur.net ? <NetSign net={cur.net} label={`${FORMAT_LABEL[team.format]} · go to net`} /> : <NetSign net="⏳" label="Waiting for a net to open" sub={FORMAT_LABEL[team.format]} />}
          <Card tone="live">
            <div className="text-xs font-black uppercase tracking-widest text-[#ffb270]">{roundLabelFor(cur, data.teams)}{losses === 1 ? ' · elimination game' : ''}</div>
            <div className="text-2xl font-black">Play {opp}</div>
            <div className="text-sm text-white/70">{rulesFor(cur).label}.{cur.net ? '' : ' Nets are full right now; this page will show your net as soon as one frees up.'}</div>
            <Button className="mt-3 w-full" onClick={() => setOpen(cur)}>Enter score</Button>
          </Card>
        </div>
      )
    } else {
      const pendingSrc = cur.team_a === team.id ? cur.src_b : cur.src_a
      top = (
        <Card tone="purple">
          <div className="text-xs font-black uppercase tracking-widest text-[#c4b5fd]">{roundLabelFor(cur, data.teams)}</div>
          <div className="text-xl font-black">Waiting for your opponent</div>
          <div className="text-sm text-white/70">You play {describeSrc(pendingSrc, data.matches, data.teams)}. Stay close to the nets.</div>
        </Card>
      )
    }
    body = (
      <div className="space-y-4">
        {top}
        <div className="flex gap-2"><Pill tone={losses === 0 ? 'green' : 'orange'}>{losses === 0 ? 'Winners bracket' : 'Losers bracket'}</Pill><Pill>{losses} {losses === 1 ? 'loss' : 'losses'}</Pill></div>
        <div>
          <H sub="You're outlined in purple. Swipe to see every round.">The bracket</H>
          <BracketDiagram matches={data.matches} teams={data.teams} format={team.format} me={team.id} />
        </div>
        {myPlayoff.length > 0 && <div><H>Your playoff games</H><div className="space-y-2">{myPlayoff.map(m => <MatchRow key={m.id} m={m} teams={data.teams} me={team.id} onTap={m.winner ? undefined : setOpen} />)}</div></div>}
        <details className="rounded-2xl border border-white/10 bg-white/5 p-3"><summary className="cursor-pointer font-bold">Pool results</summary>
          <div className="mt-3 space-y-2">{myPool.map(m => <MatchRow key={m.id} m={m} teams={data.teams} me={team.id} showNet={false} />)}</div></details>
        <Button to={`${base}/standings`} kind="ghost" className="w-full">Standings for both nets</Button>
      </div>
    )
  }

  return (
    <div>
      {header}
      {body}
      {open && <ScoreSheet match={open} teams={data.teams} onClose={() => setOpen(null)} onSave={sets => data.actions.saveScore(open, sets)} />}
    </div>
  )
}
