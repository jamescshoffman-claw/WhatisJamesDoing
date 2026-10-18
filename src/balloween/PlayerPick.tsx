import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FORMAT_LABEL } from './logic'
import { saveMe } from './store'
import { H, Msg, useBw } from './ui'

export default function PlayerPick() {
  const { base, t, data } = useBw()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const players = useMemo(() => {
    const out: { name: string; teamId: string; format: 'men' | 'women'; partner: string }[] = []
    for (const tm of data.teams) {
      out.push({ name: tm.player1, teamId: tm.id, format: tm.format, partner: tm.player2 })
      out.push({ name: tm.player2, teamId: tm.id, format: tm.format, partner: tm.player1 })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [data.teams])
  const shown = players.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.partner.toLowerCase().includes(q.toLowerCase()))
  const pick = (p: typeof players[number]) => { saveMe(t, { teamId: p.teamId, player: p.name }); nav(`${base}/me`) }
  return (
    <div>
      <H sub="Tap your name. Your phone will remember you.">Who are you?</H>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search names…" autoComplete="off"
        className="mb-3 w-full rounded-2xl border border-white/15 bg-[#1e1230] px-4 py-3 text-base text-white outline-none placeholder:text-white/40 focus:border-[#ff8a2a]" />
      {!data.loading && players.length === 0 && <Msg>No players yet. The admin needs to upload the teams.</Msg>}
      <div className="grid grid-cols-2 gap-2">
        {shown.map(p => (
          <button key={p.teamId + p.name} type="button" onClick={() => pick(p)}
            className="rounded-2xl border border-white/10 bg-[#1e1230] px-3 py-3 text-left active:scale-[0.98] active:bg-[#2a1540]">
            <div className="truncate text-base font-extrabold leading-tight">{p.name}</div>
            <div className="truncate text-xs text-white/50">w/ {p.partner.split(' ')[0]} · {FORMAT_LABEL[p.format].replace(' net', '')}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
