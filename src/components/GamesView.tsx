import { useState } from 'react';
import Avatar from './Avatar';
import type { Ctx } from '../lib/ctx';
import { same } from '../lib/ctx';
import { uid } from '../lib/room';
import { aggregate, round2, simplify } from '../lib/settle';
import type { Game, Session } from '../lib/types';
import { digits } from './SetupView';

const money = (x: number) => (x > 0 ? '+' : '') + round2(x);

export default function GamesView({ ctx, session }: { ctx: Ctx; session: Session }) {
  const { isMaster, update, me } = ctx;
  const mutate = (fn: (s: Session, d: Parameters<Parameters<typeof update>[0]>[0]) => void) =>
    update((d) => fn(d.sessions.find((x) => x.id === session.id)!, d));
  const agg = aggregate([session]);
  const ranking = [...agg.names].sort((a, b) => agg.totals[b].net - agg.totals[a].net);

  return (
    <>

      <section className="card">
        <h2>{session.name} · standings</h2>
        {session.games.length === 0 ? (
          <p className="muted">No games recorded yet.</p>
        ) : (
          <table>
            <thead><tr><th>Player</th><th>Games</th><th>Net</th></tr></thead>
            <tbody>
              {ranking.map((n) => (
                <tr key={n} className={same(n, me) ? 'me' : ''}>
                  <td><Avatar name={n} />{n}{!session.players.includes(n) && <span className="tag">left</span>}</td>
                  <td>{agg.totals[n].games}</td>
                  <td className={agg.totals[n].net >= 0 ? 'pos' : 'neg'}><b>{money(agg.totals[n].net)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isMaster && <GameForm key={session.games.length} session={session} mutate={mutate} />}
      <section className="card">
        <h2>Game history</h2>
        {[...session.games].reverse().map((g) => {
          const idx = session.games.indexOf(g) + 1;
          return (
            <div key={g.id} className="game">
              <div className="row">
                <b>Game {idx}{g.label && ` · ${g.label}`}</b>
                <span className="muted">{new Date(g.at).toLocaleString()}</span>
              </div>
              <div className="chips">
                {Object.entries(g.nets).map(([n, v]) => (
                  <span key={n} className={'chip ' + (v >= 0 ? 'pos' : 'neg')}>{n} {money(v)}</span>
                ))}
              </div>
              <ul className="log">
                {simplify(g.nets).map((t, i) => <li key={i}><b>{t.from}</b> owes <b>{t.to}</b> {t.amount}</li>)}
              </ul>
              {isMaster && (
                <button className="mini danger" onClick={() => confirm(`Delete game ${idx}?`) && mutate((s) => { s.games = s.games.filter((x) => x.id !== g.id); })}>Delete game</button>
              )}
            </div>
          );
        })}
        {session.games.length === 0 && <p className="muted">Nothing yet.</p>}
      </section>
      {isMaster && <PlayerManager ctx={ctx} session={session} mutate={mutate} />}
    </>
  );
}

function PlayerManager({ ctx, session, mutate }: { ctx: Ctx; session: Session; mutate: (fn: (s: Session, d: { contacts: Record<string, string> }) => void) => void }) {
  const [nn, setNn] = useState('');
  const [np, setNp] = useState('');
  const [err, setErr] = useState('');
  const lobby = Array.from(new Set([...ctx.view.members.map((m) => m.name), ...Object.keys(ctx.view.store.contacts)]))
    .filter((n) => !session.players.some((p) => same(p, n)));

  const add = (name: string, phone = '') => {
    name = name.trim();
    if (!name) return;
    if (session.players.some((p) => same(p, name))) return setErr('Already in this session.');
    mutate((s, d) => {
      s.players.push(name);
      if (phone) d.contacts[name] = digits(phone);
    });
    setNn('');
    setNp('');
    setErr('');
  };

  return (
    <section className="card">
      <h2>Players in {session.name}</h2>
      <div className="btns">
        {session.players.map((p) => (
          <button key={p} onClick={() => confirm(`Remove ${p} from this session? Their past games stay in the totals.`) && mutate((s) => { s.players = s.players.filter((x) => x !== p); })}>
            {p} ✕
          </button>
        ))}
      </div>
      <div className="btns">{lobby.map((n) => <button key={n} onClick={() => add(n)}>+ {n}</button>)}</div>
      <div className="grid">
        <label>New player name<input value={nn} onChange={(e) => setNn(e.target.value)} /></label>
        <label>Mobile (optional)<input inputMode="tel" value={np} onChange={(e) => setNp(e.target.value)} /></label>
      </div>
      <button disabled={!nn.trim()} onClick={() => add(nn, np)}>Add player</button>
      {err && <p className="err">{err}</p>}
    </section>
  );
}

function GameForm({ session, mutate }: { session: Session; mutate: (fn: (s: Session) => void) => void }) {
  const [label, setLabel] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  const num = (n: string) => (vals[n] === undefined || vals[n] === '' || vals[n] === '-' ? 0 : Number(vals[n]));
  const sum = round2(session.players.reduce((a, n) => a + num(n), 0));

  const balance = (n: string) => {
    const others = session.players.filter((p) => p !== n).reduce((a, p) => a + num(p), 0);
    setVals({ ...vals, [n]: String(round2(-others)) });
  };

  const save = () => {
    if (session.players.some((n) => Number.isNaN(num(n)))) return setErr('Amounts must be numbers.');
    if (sum !== 0) return setErr(`Amounts must add up to 0 (currently ${money(sum)}). Use ⚖ to balance one player.`);
    const nets: Record<string, number> = {};
    for (const n of session.players) nets[n] = num(n);
    if (Object.values(nets).every((v) => v === 0)) return setErr('Enter at least one amount.');
    const g: Game = { id: uid(), at: Date.now(), label: label.trim(), nets };
    mutate((s) => { s.games.push(g); });
  };

  return (
    <section className="card">
      <h2>Record game {session.games.length + 1}</h2>
      <p className="muted">Enter what each player won (+) or lost (−) in this game. Totals must add up to zero; ⚖ fills a player's amount so it balances (e.g. the winner).</p>
      <label>Note (optional)<input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      {session.players.map((n) => (
        <div key={n} className="amtrow">
          <span className="grow">{n}</span>
          <input type="number" inputMode="decimal" step="any" placeholder="0" value={vals[n] ?? ''} onChange={(e) => setVals({ ...vals, [n]: e.target.value })} />
          <button className="mini" title="Balance to zero" onClick={() => balance(n)}>⚖</button>
        </div>
      ))}
      <p className={sum === 0 ? 'muted' : 'warn'}>Sum: {money(sum)} {sum === 0 ? '✓' : ''}</p>
      {err && <p className="err">{err}</p>}
      <button className="primary" onClick={save}>Save game</button>
    </section>
  );
}
