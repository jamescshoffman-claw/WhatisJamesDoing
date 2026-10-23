import { FORMAT_LABEL, POOL_NAMES, poolCapOf, poolNet, rulesFor, type Format, type Stage } from './logic'
import { Card, FORMAT_COLOR, H, useBw } from './ui'

/** How the night works. Game formats come straight from rulesFor so this page can't drift from the score sheet. */
export default function Info() {
  const { data } = useBw()
  const games: { label: string; stage: Stage; round: number; note?: string }[] = [
    { label: 'Pool play', stage: 'pool', round: 1 },
    { label: 'Winners bracket', stage: 'wb', round: 1 },
    { label: 'Losers bracket, round 1', stage: 'lb', round: 1 },
    { label: 'Losers bracket, later rounds', stage: 'lb', round: 2 },
    { label: 'Grand final', stage: 'gf', round: 1, note: 'If the losers-bracket team wins it, one more grand final decides it.' },
  ]
  return (
    <div className="space-y-4">
      <H sub="Everything you need to know for tonight.">Info</H>

      <Card tone="orange">
        <div className="text-lg font-extrabold">1. Sign your team in</div>
        <p className="text-sm text-white/70">Pick your name, then tap "We're here". Only one of you needs to do it.</p>
      </Card>

      <Card>
        <div className="text-lg font-extrabold">2. Find your net</div>
        <p className="mb-3 text-sm text-white/70">Men's and coed teams play on nets A to D. Women's and reverse coed teams play on nets E to H. Your page always shows the net to go to.</p>
        <div className="grid grid-cols-2 gap-3">
          {(['men', 'women'] as Format[]).map(f => (
            <div key={f} className="rounded-xl p-3" style={{ background: FORMAT_COLOR[f].soft }}>
              <div className="mb-1 text-xs font-black uppercase tracking-widest" style={{ color: FORMAT_COLOR[f].text }}>{FORMAT_LABEL[f]}</div>
              {Object.entries(POOL_NAMES[f]).map(([letter, name]) => (
                <div key={letter} className="flex justify-between text-sm"><span>{name}</span><span className="font-black">Net {poolNet(f, letter)}</span></div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="text-lg font-extrabold">3. Pool play</div>
        <p className="text-sm text-white/70">Every team plays every other team in its pool. Pools are ranked by win %, then head-to-head (when two teams are tied), then point differential, then points scored.</p>
      </Card>

      <Card>
        <div className="text-lg font-extrabold">4. Playoffs: double elimination</div>
        <p className="text-sm text-white/70">Every team makes the playoffs. Pool winners get the top seeds, then the runners-up, and so on. Lose once and you drop to the losers bracket. Lose twice and you're out. Nets are handed out as they free up, so watch your page.</p>
      </Card>

      <Card>
        <div className="mb-2 text-lg font-extrabold">Game formats</div>
        <div className="divide-y divide-white/10">
          {games.map(g => {
            const r = rulesFor(g, poolCapOf(data.states, 'men'))
            return (
              <div key={g.label} className="py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-bold">{g.label}</span>
                  <span className="shrink-0 rounded-full bg-[#8b5cf6]/25 px-2 py-0.5 text-xs font-black text-[#c4b5fd]">{r.bestOf === 1 ? '1 set' : 'Best of 3'}</span>
                </div>
                <div className="text-sm text-white/60">{r.label}.{g.note ? ` ${g.note}` : ''}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="text-lg font-extrabold">5. Enter your score</div>
        <p className="text-sm text-white/70">When a game ends, either team taps it on their page and enters the score. The bracket updates for everyone right away.</p>
      </Card>
    </div>
  )
}
