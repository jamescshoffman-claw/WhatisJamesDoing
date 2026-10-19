// Supabase-backed state for Balloween: one hook that loads everything for a tournament key ('live' | 'test'),
// keeps it fresh over realtime + polling, and exposes the admin/player actions.
import { createClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyPatches, assignPools, buildBracket, buildPoolMatches, champion, poolsComplete, reconcile, rulesFor, seedTeams, teamName,
  winnerFromSets, type Format, type FormatState, type Match, type ParsedTeam, type Phase, type Team, type TKey,
} from './logic'
import { randomSet, sampleTeams } from './sample'

export const ADMIN_PASSWORD = 'monkey'
export const FORMATS: Format[] = ['men', 'women']
const SUPABASE_URL = 'https://sofrzvspjrvtovksjdvi.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Zh07DXhCr6jAcy1ZDAiviQ_XPFjings'
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

export interface Data { teams: Team[]; matches: Match[]; states: FormatState[] }
const EMPTY: Data = { teams: [], matches: [], states: [] }
const now = () => new Date().toISOString()
function throwIf(e: { message: string } | null | undefined) { if (e) throw new Error(e.message) }

export function phaseOf(states: FormatState[], format: Format): Phase {
  return states.find(s => s.format === format)?.phase ?? 'setup'
}

async function fetchAll(t: TKey): Promise<Data> {
  const [a, b, c] = await Promise.all([
    sb.from('bw_teams').select('*').eq('t', t).order('created_at'),
    sb.from('bw_matches').select('*').eq('t', t).order('round').order('slot'),
    sb.from('bw_state').select('*').eq('t', t),
  ])
  throwIf(a.error || b.error || c.error)
  return { teams: (a.data || []) as Team[], matches: (b.data || []) as Match[], states: (c.data || []) as FormatState[] }
}

export class Actions {
  constructor(private t: TKey, private get: () => Data, private refresh: () => Promise<void>) {}

  private async setPhase(format: Format, phase: Phase) {
    throwIf((await sb.from('bw_state').upsert({ t: this.t, format, phase, updated_at: now() })).error)
  }

  /** Push reconcile() patches for one format, working from a fresh read so concurrent phones don't fight. */
  private async reconcileFormat(format: Format) {
    const fresh = await fetchAll(this.t)
    const patches = reconcile(fresh.matches, fresh.teams, format)
    const results = await Promise.all(Object.entries(patches).map(([key, p]) =>
      sb.from('bw_matches').update({ ...p, updated_at: now() }).eq('t', this.t).eq('key', key)))
    for (const r of results) throwIf(r.error)
  }

  // ---- teams
  async addTeams(rows: ParsedTeam[]) {
    if (!rows.length) return
    const { error } = await sb.from('bw_teams').insert(rows.map(r => ({
      t: this.t, format: r.format, player1: r.player1.trim(), player2: r.player2.trim(), name: (r.name || '').trim() || teamName(r.player1, r.player2),
    })))
    throwIf(error)
    await this.refresh()
  }
  async removeTeam(id: string) {
    throwIf((await sb.from('bw_teams').delete().eq('t', this.t).eq('id', id)).error)
    await this.refresh()
  }
  async renameTeam(id: string, player1: string, player2: string) {
    throwIf((await sb.from('bw_teams').update({ player1, player2, name: teamName(player1, player2) }).eq('t', this.t).eq('id', id)).error)
    await this.refresh()
  }

  // ---- pools
  async generatePools(format: Format) {
    const teams = this.get().teams.filter(x => x.format === format)
    if (teams.length < 3) throw new Error('Need at least 3 teams in this format to draw pools.')
    throwIf((await sb.from('bw_matches').delete().eq('t', this.t).eq('format', format)).error)
    const pools = assignPools(teams)
    const updated = teams.map(x => ({ ...x, pool: pools[x.id], seed: null }))
    const ups = await Promise.all(updated.map(x => sb.from('bw_teams').update({ pool: x.pool, seed: null }).eq('t', this.t).eq('id', x.id)))
    for (const r of ups) throwIf(r.error)
    throwIf((await sb.from('bw_matches').insert(buildPoolMatches(this.t, format, updated))).error)
    await this.setPhase(format, 'pools')
    await this.refresh()
  }

  // ---- scores
  async saveScore(match: Match, sets: [number, number][]) {
    const side = winnerFromSets(sets, rulesFor(match))
    if (!side) throw new Error('That score does not decide a winner yet.')
    const winner = side === 'a' ? match.team_a : match.team_b
    throwIf((await sb.from('bw_matches').update({ sets, winner, updated_at: now() }).eq('t', this.t).eq('id', match.id)).error)
    if (match.stage !== 'pool') await this.reconcileFormat(match.format)
    await this.refresh()
  }
  async clearScore(match: Match) {
    throwIf((await sb.from('bw_matches').update({ sets: [], winner: null, updated_at: now() }).eq('t', this.t).eq('id', match.id)).error)
    if (match.stage !== 'pool') await this.reconcileFormat(match.format)
    await this.refresh()
  }
  async setNet(match: Match, net: string | null) {
    throwIf((await sb.from('bw_matches').update({ net, updated_at: now() }).eq('t', this.t).eq('id', match.id)).error)
    await this.refresh()
  }
  async recheck(format: Format) { await this.reconcileFormat(format); await this.refresh() }

  // ---- playoffs
  async startPlayoffs(format: Format) {
    const fresh = await fetchAll(this.t)
    if (!poolsComplete(fresh.matches, format)) throw new Error('Every pool game needs a score first.')
    const teams = fresh.teams.filter(x => x.format === format)
    const seeded = seedTeams(teams, fresh.matches.filter(m => m.format === format))
    const ups = await Promise.all(seeded.map((x, i) => sb.from('bw_teams').update({ seed: i + 1 }).eq('t', this.t).eq('id', x.id)))
    for (const r of ups) throwIf(r.error)
    throwIf((await sb.from('bw_matches').delete().eq('t', this.t).eq('format', format).neq('stage', 'pool')).error)
    throwIf((await sb.from('bw_matches').insert(buildBracket(this.t, format, seeded.length))).error)
    await this.reconcileFormat(format)
    await this.setPhase(format, 'preview')
    await this.refresh()
  }
  async publishPlayoffs(format: Format) { await this.setPhase(format, 'playoffs'); await this.refresh() }
  async unpublishPlayoffs(format: Format) { await this.setPhase(format, 'preview'); await this.refresh() }

  // ---- danger zone
  async restart() {
    throwIf((await sb.from('bw_matches').delete().eq('t', this.t)).error)
    throwIf((await sb.from('bw_teams').update({ pool: null, seed: null }).eq('t', this.t)).error)
    for (const f of FORMATS) await this.setPhase(f, 'setup')
    await this.refresh()
  }
  async clearAll() {
    throwIf((await sb.from('bw_matches').delete().eq('t', this.t)).error)
    throwIf((await sb.from('bw_teams').delete().eq('t', this.t)).error)
    throwIf((await sb.from('bw_state').delete().eq('t', this.t)).error)
    await this.refresh()
  }

  // ---- simulation (test mode)
  async loadSample() { await this.clearAll(); await this.addTeams(sampleTeams()) }

  private async playOne(m: Match) {
    const r = rulesFor(m); const sets: [number, number][] = []
    while (winnerFromSets(sets, r) === null) sets.push(randomSet(r.target, r.winBy2))
    await this.saveScore(m, sets)
  }
  /** Play one pending game per net in this format (pools or playoffs). Returns how many were played. */
  async playRound(format: Format): Promise<number> {
    const fresh = await fetchAll(this.t)
    const phase = phaseOf(fresh.states, format)
    let todo: Match[] = []
    if (phase === 'pools' || phase === 'preview') {
      const seen = new Set<string>()
      for (const m of fresh.matches.filter(m => m.format === format && m.stage === 'pool' && !m.winner)) {
        if (m.net && seen.has(m.net)) continue
        if (m.net) seen.add(m.net)
        todo.push(m)
      }
    } else if (phase === 'playoffs') {
      todo = fresh.matches.filter(m => m.format === format && m.stage !== 'pool' && m.team_a && m.team_b && !m.winner && !m.void && m.net)
    }
    for (const m of todo) await this.playOne(m)
    return todo.length
  }
  async finishPools(format: Format) {
    for (let i = 0; i < 30; i++) { if ((await this.playRound(format)) === 0) break }
  }
  async finishPlayoffs(format: Format) {
    for (let i = 0; i < 60; i++) {
      const fresh = await fetchAll(this.t)
      if (champion(fresh.matches, format) || phaseOf(fresh.states, format) !== 'playoffs') break
      if ((await this.playRound(format)) === 0) { await this.reconcileFormat(format) }
    }
    await this.refresh()
  }
}

export function useTournament(t: TKey) {
  const [data, setData] = useState<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef(data); ref.current = data
  const refresh = useCallback(async () => {
    try { setData(await fetchAll(t)); setError(null) } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [t])
  useEffect(() => {
    refresh()
    let timer: number | undefined
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(refresh, 300) }
    const ch = sb.channel(`bw-${t}-${Math.random().toString(36).slice(2, 8)}`)
    for (const table of ['bw_teams', 'bw_matches', 'bw_state']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `t=eq.${t}` }, schedule)
    }
    ch.subscribe()
    const iv = window.setInterval(refresh, 20000)
    const vis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', vis)
    return () => { sb.removeChannel(ch); window.clearInterval(iv); window.clearTimeout(timer); document.removeEventListener('visibilitychange', vis) }
  }, [t, refresh])
  const actions = useMemo(() => new Actions(t, () => ref.current, refresh), [t, refresh])
  return { ...data, loading, error, refresh, actions }
}

// ---- who am I (per device)
export interface Me { teamId: string; player: string }
export function loadMe(t: TKey): Me | null {
  try { const raw = localStorage.getItem(`bw-${t}-me`); return raw ? JSON.parse(raw) : null } catch { return null }
}
export function saveMe(t: TKey, me: Me | null) {
  try { if (me) localStorage.setItem(`bw-${t}-me`, JSON.stringify(me)); else localStorage.removeItem(`bw-${t}-me`) } catch { /* private mode */ }
}
export function isAdmin(): boolean { try { return sessionStorage.getItem('bw-admin') === '1' } catch { return false } }
export function setAdmin(on: boolean) { try { if (on) sessionStorage.setItem('bw-admin', '1'); else sessionStorage.removeItem('bw-admin') } catch { /* ignore */ } }

export type Tournament = ReturnType<typeof useTournament>
export { applyPatches }
