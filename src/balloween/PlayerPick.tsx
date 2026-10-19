import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FORMAT_LABEL, type Format } from './logic'
import { saveMe } from './store'
import { Button, FORMAT_COLOR, H, Msg, cx, useBw } from './ui'

interface Entry { name: string; teamId: string; format: Format; partner: string }

export default function PlayerPick() {
  const { base, t, data } = useBw()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Entry | null>(null)
  const players = useMemo(() => {
    const out: Entry[] = []
    for (const tm of data.teams) {
      out.push({ name: tm.player1, teamId: tm.id, format: tm.format, partner: tm.player2 })
      out.push({ name: tm.player2, teamId: tm.id, format: tm.format, partner: tm.player1 })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [data.teams])
  const shown = players.filter(p => !q || p.name.toLowerCase().includes(q.trim().toLowerCase()))
  const isPicked = (p: Entry) => picked?.teamId === p.teamId && picked.name === p.name
  const confirm = () => { if (!picked) return; saveMe(t, { teamId: picked.teamId, player: picked.name }); nav(`${base}/me`) }
  return (
    <div className={cx(picked && 'pb-32')}>
      <H sub="Tap your name, then confirm. Your phone will remember you.">Who are you?</H>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search names…" autoComplete="off"
        className="mb-3 w-full rounded-2xl border border-white/15 bg-[#1e1230] px-4 py-3 text-base text-white outline-none placeholder:text-white/40 focus:border-[#ff8a2a]" />
      {!data.loading && players.length === 0 && <Msg>No players yet. The admin needs to upload the teams.</Msg>}
      <div className="grid grid-cols-2 gap-2">
        {shown.map(p => {
          const on = isPicked(p)
          return (
            <button key={p.teamId + p.name} type="button" onClick={() => (on ? confirm() : setPicked(p))} aria-pressed={on}
              className={cx('relative rounded-2xl border-2 px-3 py-3 text-left transition active:scale-[0.98]',
                on ? 'border-[#ff8a2a] bg-[#ff8a2a] text-[#1a0d05] shadow-[0_0_28px_rgba(255,138,42,0.45)]' : 'border-white/10 bg-[#1e1230] active:bg-[#2a1540]')}>
              {on && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1a0d05] text-sm font-black text-[#ff8a2a]">✓</span>}
              <div className="truncate pr-6 text-base font-extrabold leading-tight">{p.name}</div>
              <div className={cx('truncate text-xs', on ? 'text-[#1a0d05]/80' : 'text-white/50')}>
<span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: FORMAT_COLOR[p.format].fill }} />w/ {p.partner.split(' ')[0]}
              </div>
            </button>
          )
        })}
      </div>
      {picked && (
        <div className="fixed inset-x-0 bottom-[64px] z-30 px-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="mx-auto max-w-md rounded-3xl border-2 border-[#ff8a2a] bg-[#1e1230] p-4 shadow-2xl">
            <div className="text-xs font-black uppercase tracking-widest text-[#ffb270]">You picked</div>
            <div className="text-xl font-black leading-tight">{picked.name}</div>
            <div className="text-sm text-white/70">with {picked.partner} · <span style={{ color: FORMAT_COLOR[picked.format].text }}>{FORMAT_LABEL[picked.format]}</span></div>
            <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
              <Button kind="ghost" onClick={() => setPicked(null)}>Not me</Button>
              <Button kind="green" onClick={confirm}>Yes, that's me</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
