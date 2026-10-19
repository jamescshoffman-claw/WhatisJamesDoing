import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { TKey } from './logic'
import { isAdmin, loadMe, setAdmin, useTournament } from './store'
import { Button, BwContext, Msg, Pill, cx, useBw } from './ui'
import PlayerPick from './PlayerPick'
import TeamView from './TeamView'
import Standings from './Standings'
import Admin from './Admin'
import './balloween.css'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return null
}

export default function Balloween({ t }: { t: TKey }) {
  const data = useTournament(t)
  const [admin, setAdminState] = useState(isAdmin())
  const base = t === 'test' ? '/Balloween/Test' : '/Balloween'
  useEffect(() => { document.title = t === 'test' ? 'Balloween · Test' : 'Balloween' }, [t])
  const ctx = { t, base, data, admin, setAdminState: (b: boolean) => { setAdmin(b); setAdminState(b) } }
  return (
    <BwContext.Provider value={ctx}>
      <div className="bw min-h-screen bg-[#120a1c] text-[#f5efe6] antialiased" style={{ fontFamily: 'var(--font-sans)' }}>
        <ScrollToTop />
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#120a1c]/90 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
            <Link to={`${base}?menu=1`} className="text-xl font-black tracking-tight"><span className="mr-1">🎃</span>Balloween</Link>
            <div className="flex items-center gap-2">
              {t === 'test' && <Pill tone="orange">Test mode</Pill>}
              {admin && <Pill tone="purple">Admin</Pill>}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 pb-28 pt-4">
          {data.error && (
            <div className="mb-4"><Msg tone="error">Can't reach the tournament database: {data.error}. If this is the first run, the SQL in supabase/balloween.sql still needs to be run in Supabase.</Msg></div>
          )}
          <Routes>
            <Route index element={<Landing />} />
            <Route path="player" element={<PlayerPick />} />
            <Route path="me" element={<TeamView />} />
            <Route path="standings" element={<Standings />} />
            <Route path="admin" element={<Admin />} />
            <Route path="*" element={<Navigate to={base} replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BwContext.Provider>
  )
}

function Landing() {
  const { base, t, data } = useBw()
  const { search } = useLocation()
  const me = loadMe(t)
  const known = me && data.teams.some(x => x.id === me.teamId) ? me : null
  const stay = new URLSearchParams(search).has('menu')
  if (known && !stay) return <Navigate to={`${base}/me`} replace />
  return (
    <div className="space-y-6 pt-6">
      <div className="text-center">
        <div className="text-6xl">🏐</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Balloween</h1>
        <p className="mt-1 text-white/60">Find your net. Play your games. Enter your scores.</p>
      </div>
      <div className="space-y-3">
        {known && <Button to={`${base}/me`} className="w-full py-5 text-lg">Continue as {known.player}</Button>}
        <Button to={`${base}/player`} kind={known ? 'ghost' : 'primary'} className={cx('w-full', !known && 'py-5 text-lg')}>{known ? 'Pick a different name' : "I'm a player"}</Button>
        <Button to={`${base}/standings`} kind="purple" className="w-full">Standings &amp; bracket</Button>
        <Button to={`${base}/admin`} kind="ghost" className="w-full">Admin</Button>
      </div>
      {data.loading && <p className="text-center text-sm text-white/40">Loading…</p>}
      {t === 'test' && <Msg>This is the test tournament with sample data. The real one is at <Link className="underline" to="/Balloween">/Balloween</Link>.</Msg>}
    </div>
  )
}

function BottomNav() {
  const { base, admin } = useBw()
  const { pathname } = useLocation()
  const items = [
    { to: `${base}/me`, label: 'Me', icon: '🙋' },
    { to: `${base}/standings`, label: 'Standings', icon: '📊' },
    ...(admin ? [{ to: `${base}/admin`, label: 'Admin', icon: '🔑' }] : []),
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#1a1028]/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className={cx('mx-auto grid max-w-md', items.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {items.map(it => {
          const active = pathname.toLowerCase().startsWith(it.to.toLowerCase())
          return (
            <Link key={it.to} to={it.to} className={cx('flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold', active ? 'text-[#ff8a2a]' : 'text-white/60')}>
              <span className="text-xl leading-none">{it.icon}</span>{it.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
